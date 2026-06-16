/**
 * The Gnaver route & schedule optimizer.
 *
 * Strategy (deterministic, fast, explainable):
 *  1. Score every place against the traveller's interests, ratings & must-see flags.
 *  2. Build each day forward in time with a greedy "best value per minute" pick,
 *     honouring opening hours, weather, transport speed, the day's time window,
 *     custom start/end points, and inserting meals when meal windows arrive.
 *  3. Polish each day's ordering with a feasibility-preserving 2-opt pass to cut
 *     backtracking, re-simulating the timeline so no constraint is violated.
 *
 * It is pure: travel times come in via an injected `travel` function (real
 * routing data in the app, haversine estimate in tests / offline).
 */

import { evaluateVisit, openRangesForDate, weatherImpact } from './constraints';
import { estimateLeg } from './geo';
import { buildDirectionsUrl } from './googleMaps';
import { sumEntryCost } from './currency';
import { formatMinutes } from './time';
import type {
  DayPlan,
  DayWeather,
  DayWindow,
  ItineraryResult,
  LatLng,
  Place,
  RouteLeg,
  ScheduledStop,
  TransportMode,
  Trip,
  TripPreferences,
} from './types';

export type TravelFn = (from: LatLng, to: LatLng, mode: TransportMode) => RouteLeg;

export interface OptimizeInput {
  trip: Trip;
  /** Injected travel estimator. Defaults to the haversine model. */
  travel?: TravelFn;
  /** Forecast keyed by ISO date. */
  weatherByDate?: Record<string, DayWeather>;
  /** Ranked food candidates per ISO date (from the taste recommender). */
  foodByDate?: Record<string, Place[]>;
  /** Current moment, to avoid scheduling in the past on the first day. */
  now?: { date: string; minutes: number };
}

const LUNCH_WINDOW = { start: 12 * 60, end: 14 * 60 + 30 };
const DINNER_WINDOW = { start: 18 * 60 + 30, end: 21 * 60 };
const MAX_FOOD_DETOUR_MIN = 25;

const PACE_DWELL_FACTOR: Record<TripPreferences['pace'], number> = {
  relaxed: 1.25,
  balanced: 1,
  packed: 0.8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Value model
// ─────────────────────────────────────────────────────────────────────────────

/** Base desirability of a place given preferences (weather applied later). */
export function baseValue(place: Place, prefs: TripPreferences): number {
  const interests = prefs.interests ?? [];
  let interestFactor = 0.7;
  if (interests.length > 0) {
    const overlap = place.interests.filter((i) => interests.includes(i)).length;
    interestFactor = 0.5 + Math.min(1, overlap / Math.max(1, Math.min(3, interests.length))) * 1.0;
  }

  const rating = place.rating ?? 3.8;
  const ratingScore = rating / 5; // 0..1
  const popularity = place.userRatingsTotal
    ? Math.min(1.5, Math.log10(place.userRatingsTotal + 1) / 4)
    : 0.3;

  let value = 10 * interestFactor * (0.55 + 0.6 * ratingScore) + popularity * 2;
  if (place.mustSee) value *= 3;
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Day construction
// ─────────────────────────────────────────────────────────────────────────────

interface BuiltStop {
  place: Place;
  arrivalMinutes: number;
  entryMinutes: number;
  departureMinutes: number;
  waitMinutes: number;
  leg: RouteLeg;
  warnings: string[];
  isFood: boolean;
  adjValue: number;
}

interface DayContext {
  window: DayWindow;
  weather?: DayWeather;
  food: Place[];
  prefs: TripPreferences;
  travel: TravelFn;
  startMinutes: number;
}

function dwellFor(place: Place, prefs: TripPreferences): number {
  if (place.isFood) return place.dwellMinutes; // meals keep their own duration
  return Math.round(place.dwellMinutes * PACE_DWELL_FACTOR[prefs.pace]);
}

/**
 * Try to schedule `place` arriving from `pos` at `time`; null if infeasible.
 * `pos` is null only for the very first stop of a day that has no fixed start
 * point — in that case there is no travel leg (you simply begin there).
 */
function tryStop(
  place: Place,
  pos: LatLng | null,
  time: number,
  ctx: DayContext,
  isFood: boolean,
): BuiltStop | null {
  const leg: RouteLeg = pos
    ? ctx.travel(pos, place.location, ctx.prefs.transport)
    : { mode: 'walk', distanceMeters: 0, durationMinutes: 0 };

  if (
    ctx.prefs.maxWalkMinutes != null &&
    leg.mode === 'walk' &&
    leg.durationMinutes > ctx.prefs.maxWalkMinutes
  ) {
    return null;
  }

  const arrival = time + leg.durationMinutes;
  const dwell = dwellFor(place, ctx.prefs);
  const vis = evaluateVisit(place.openingHours, ctx.window.date, arrival, dwell, ctx.window.endMinutes);
  if (!vis.feasible) return null;

  // Must still be able to reach the day's end point in time, if one is set.
  if (ctx.window.endLocation) {
    const toEnd = ctx.travel(place.location, ctx.window.endLocation, ctx.prefs.transport);
    if (vis.departMinutes + toEnd.durationMinutes > ctx.window.endMinutes) return null;
  }

  const wx = weatherImpact(place, ctx.weather, ctx.prefs);
  const warnings = [...wx.warnings];

  // "Closing soon" nudge if we leave within 20 min of a closing edge.
  if (place.openingHours && !place.openingHours.alwaysOpen) {
    for (const r of openRangesForDate(place.openingHours, ctx.window.date)) {
      if (vis.departMinutes <= r.close && r.close - vis.departMinutes <= 20) {
        warnings.push('Closes soon after your visit');
      }
    }
  }

  return {
    place,
    arrivalMinutes: arrival,
    entryMinutes: vis.entryMinutes,
    departureMinutes: vis.departMinutes,
    waitMinutes: vis.waitMinutes,
    leg,
    warnings,
    isFood,
    adjValue: baseValue(place, ctx.prefs) * wx.multiplier,
  };
}

/**
 * Pick a food candidate near `pos` at `time`. Prefers one within a short
 * detour, but will travel further rather than skip a meal — people eat.
 * Candidates arrive pre-ranked by taste, so the first feasible is the best.
 */
function pickMeal(pos: LatLng | null, time: number, dwell: number, ctx: DayContext): BuiltStop | null {
  let fallback: BuiltStop | null = null;
  for (const cand of ctx.food) {
    const meal: Place = { ...cand, dwellMinutes: dwell, isFood: true };
    const stop = tryStop(meal, pos, time, ctx, true);
    if (!stop) continue;
    if (stop.leg.durationMinutes <= MAX_FOOD_DETOUR_MIN) return stop;
    if (!fallback) fallback = stop;
  }
  return fallback;
}

function buildDay(pool: Place[], ctx: DayContext): { stops: BuiltStop[]; used: Set<string> } {
  const stops: BuiltStop[] = [];
  const used = new Set<string>();
  const eaten = { lunch: false, dinner: false };
  const includeFood = ctx.prefs.includeFood && ctx.food.length > 0;

  // null start = no fixed day-start point; the first chosen stop begins the day
  // with a zero travel leg. Same anchoring is used by `simulate` (2-opt).
  let pos: LatLng | null = ctx.window.startLocation ?? null;
  let time = ctx.startMinutes;

  for (let guard = 0; guard < 60; guard++) {
    // Eat lunch at the first free moment after noon (before dinner time).
    if (includeFood && !eaten.lunch && time >= LUNCH_WINDOW.start && time < DINNER_WINDOW.start) {
      const meal = pickMeal(pos, time, 60, ctx);
      eaten.lunch = true;
      if (meal) {
        stops.push(meal);
        pos = meal.place.location;
        time = meal.departureMinutes;
        continue;
      }
    }
    // Dinner once we cross into the evening, while the day window still allows it.
    if (includeFood && !eaten.dinner && time >= DINNER_WINDOW.start && time <= ctx.window.endMinutes) {
      const meal = pickMeal(pos, time, 90, ctx);
      eaten.dinner = true;
      if (meal) {
        stops.push(meal);
        pos = meal.place.location;
        time = meal.departureMinutes;
        continue;
      }
    }

    let best: BuiltStop | null = null;
    let bestEff = -Infinity;
    for (const place of pool) {
      if (used.has(place.id)) continue;
      const stop = tryStop(place, pos, time, ctx, false);
      if (!stop) continue;
      const cost = stop.leg.durationMinutes + stop.waitMinutes + dwellFor(place, ctx.prefs);
      const eff = stop.adjValue / Math.max(15, cost);
      if (eff > bestEff) {
        bestEff = eff;
        best = stop;
      }
    }

    if (!best) break;
    stops.push(best);
    used.add(best.place.id);
    pos = best.place.location;
    time = best.departureMinutes;
  }

  return { stops, used };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2-opt polish (minimise travel without breaking feasibility)
// ─────────────────────────────────────────────────────────────────────────────

function simulate(order: Place[], ctx: DayContext): BuiltStop[] | null {
  const stops: BuiltStop[] = [];
  // Mirror buildDay exactly: null start → first stop has a zero leg.
  let pos: LatLng | null = ctx.window.startLocation ?? null;
  let time = ctx.startMinutes;
  for (const place of order) {
    const stop = tryStop(place, pos, time, ctx, !!place.isFood);
    if (!stop) return null; // ordering is infeasible
    stops.push(stop);
    pos = place.location;
    time = stop.departureMinutes;
  }
  return stops;
}

function travelTotal(stops: BuiltStop[]): number {
  return stops.reduce((sum, s) => sum + s.leg.durationMinutes, 0);
}

/** Classic 2-opt over the non-food stops, keeping meals pinned in place. */
function twoOpt(stops: BuiltStop[], ctx: DayContext): BuiltStop[] {
  // Meals are time-anchored; only reorder the attraction segments around them.
  if (stops.length < 4) return stops;
  let best = stops;
  let bestCost = travelTotal(stops);
  let improved = true;
  let rounds = 0;
  while (improved && rounds < 8) {
    improved = false;
    rounds++;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        if (best[i].isFood || best[k].isFood) continue;
        const order = best.map((s) => s.place);
        const segment = order.slice(i, k + 1).reverse();
        const candidateOrder = [...order.slice(0, i), ...segment, ...order.slice(k + 1)];
        const sim = simulate(candidateOrder, ctx);
        if (sim) {
          const cost = travelTotal(sim);
          if (cost < bestCost - 0.5) {
            best = sim;
            bestCost = cost;
            improved = true;
          }
        }
      }
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────

function toScheduledStop(b: BuiltStop): ScheduledStop {
  return {
    place: b.place,
    arrivalMinutes: b.entryMinutes,
    departureMinutes: b.departureMinutes,
    arrival: formatMinutes(b.entryMinutes),
    departure: formatMinutes(b.departureMinutes),
    // Omit the phantom zero leg when a day has no fixed start point.
    legToHere: b.leg.distanceMeters === 0 && b.leg.durationMinutes === 0 ? undefined : b.leg,
    waitMinutes: b.waitMinutes || undefined,
    warnings: b.warnings.length ? b.warnings : undefined,
    isFood: b.isFood || undefined,
  };
}

function assembleDay(builtStops: BuiltStop[], ctx: DayContext, trip: Trip): DayPlan {
  const stops = builtStops.map(toScheduledStop);
  const totalDistanceMeters = builtStops.reduce((s, b) => s + b.leg.distanceMeters, 0);
  const totalTravelMinutes = builtStops.reduce((s, b) => s + b.leg.durationMinutes, 0);
  const cost = sumEntryCost(builtStops.map((b) => b.place), trip.currency);

  const points: LatLng[] = [];
  if (ctx.window.startLocation) points.push(ctx.window.startLocation);
  for (const b of builtStops) points.push(b.place.location);
  if (ctx.window.endLocation) points.push(ctx.window.endLocation);

  const dayWarnings: string[] = [];
  if (ctx.weather && (ctx.weather.condition === 'rain' || ctx.weather.precipitationProbability >= 60)) {
    dayWarnings.push('Rain expected — indoor stops favoured');
  }

  return {
    date: ctx.window.date,
    window: ctx.window,
    stops,
    startLocation: ctx.window.startLocation,
    endLocation: ctx.window.endLocation,
    totalDistanceMeters,
    totalTravelMinutes,
    totalCost: cost,
    unscheduled: [],
    weather: ctx.weather,
    googleMapsUrl: buildDirectionsUrl(points, trip.preferences.transport),
    warnings: dayWarnings.length ? dayWarnings : undefined,
  };
}

/**
 * Optimise a full trip into day-by-day plans. Places that don't fit anywhere
 * are returned in `unscheduled` so the UI can offer them for re-selection.
 */
export function optimizeItinerary(input: OptimizeInput): ItineraryResult {
  const { trip } = input;
  const travel = input.travel ?? estimateLeg;
  const pool = trip.places.filter((p) => !p.isFood);
  const remaining = new Map(pool.map((p) => [p.id, p]));
  const days: DayPlan[] = [];
  let totalScore = 0;

  for (const window of trip.days) {
    let startMinutes = window.startMinutes;
    if (input.now && input.now.date === window.date) {
      startMinutes = Math.max(startMinutes, input.now.minutes);
    }

    const ctx: DayContext = {
      window,
      weather: input.weatherByDate?.[window.date],
      food: input.foodByDate?.[window.date] ?? [],
      prefs: trip.preferences,
      travel,
      startMinutes,
    };

    const { stops } = buildDay([...remaining.values()], ctx);
    const polished = twoOpt(stops, ctx);

    for (const b of polished) {
      if (!b.isFood) remaining.delete(b.place.id);
      totalScore += b.adjValue;
    }

    days.push(assembleDay(polished, ctx, trip));
  }

  return {
    trip,
    days,
    unscheduled: [...remaining.values()],
    generatedAt: new Date().toISOString(),
    score: Math.round(totalScore),
  };
}
