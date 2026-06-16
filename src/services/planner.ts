/**
 * generateItinerary — high-level orchestrator the UI calls.
 *
 * Wires together all four providers (places, routing, weather, taste) and the
 * pure core optimizer. Every provider failure is caught; the optimizer always
 * gets at least haversine travel estimates so it can produce a result even
 * when the device is fully offline.
 */

import type { ItineraryResult, LatLng, Place, TransitStep, TransportMode, Trip } from '@/core';
import { centroid, estimateLeg, optimizeItinerary } from '@/core';
import type { TravelFn } from '@/core/optimizer';
import { placesProvider } from './places';
import { routingProvider, buildTravelFn } from './routing';
import { weatherProvider } from './weather';
import { tasteProvider } from './llm';
import { features } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Current moment — prevents scheduling in the past on the first day. */
  now?: { date: string; minutes: number };
  /** Caller can pass an AbortSignal to cancel in-flight provider requests. */
  signal?: AbortSignal;
}

/**
 * Generate a full itinerary for `trip`.
 *
 * Steps:
 *  (a) Weather forecast for all trip dates.
 *  (b) Routing matrix over all relevant points → sync TravelFn for optimizer.
 *  (c) Food suggestions + LLM ranking per day (when prefs.includeFood).
 *  (d) Pure optimizeItinerary with live data.
 */
export async function generateItinerary(
  trip: Trip,
  opts?: GenerateOptions,
): Promise<ItineraryResult> {
  const aborted = () => opts?.signal?.aborted ?? false;

  // ── (a) Weather ──────────────────────────────────────────────────────────
  const forecastCenter: LatLng =
    trip.center ??
    centroid(trip.places.map((p) => p.location)) ??
    { lat: 0, lng: 0 };

  const dates = trip.days.map((d) => d.date);

  let weatherByDate: Record<string, import('@/core').DayWeather> = {};
  try {
    if (!aborted()) {
      const forecasts = await weatherProvider.forecast(forecastCenter, dates);
      for (const f of forecasts) {
        weatherByDate[f.date] = f;
      }
    }
  } catch {
    // Provider already catches internally; this is a belt-and-suspenders guard.
    weatherByDate = {};
  }

  // ── (b) Routing matrix ───────────────────────────────────────────────────
  // Collect all points that need travel times:
  //   - each day's start/end location
  //   - every selected place
  const pointSet: LatLng[] = [];
  const seen = new Set<string>();
  const addPt = (p: LatLng) => {
    const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    if (!seen.has(k)) { seen.add(k); pointSet.push(p); }
  };

  for (const day of trip.days) {
    if (day.startLocation) addPt(day.startLocation);
    if (day.endLocation) addPt(day.endLocation);
  }
  for (const place of trip.places) {
    addPt(place.location);
  }

  let travel: TravelFn = estimateLeg; // safe default
  if (!aborted() && pointSet.length > 0) {
    try {
      const matrix = await routingProvider.matrix(pointSet, trip.preferences.transport);
      travel = buildTravelFn(pointSet, matrix, trip.preferences.transport);
    } catch {
      travel = estimateLeg;
    }
  }

  // ── (c) Food suggestions per day ─────────────────────────────────────────
  const foodByDate: Record<string, Place[]> = {};

  if (trip.preferences.includeFood && !aborted()) {
    // Run all days concurrently — each day is independent
    await Promise.allSettled(
      trip.days.map(async (day) => {
        if (aborted()) return;
        try {
          // Day centroid: use the start location or the centroid of all places
          const dayPlaceLocations = trip.places.map((p) => p.location);
          const near: LatLng =
            day.startLocation ??
            centroid(dayPlaceLocations) ??
            forecastCenter;

          // Don't pre-filter by open-now at the day's *start* (e.g. 9am) — that
          // wrongly drops dinner-only spots. The optimizer's evaluateVisit checks
          // each candidate's hours at the actual meal time, so fetch broadly.
          const candidates = await placesProvider.suggestFood({
            near,
            budget: trip.preferences.foodBudget,
            cuisine: trip.preferences.cuisinePrefs,
            dietary: trip.preferences.dietary,
            includeQuick: trip.preferences.foodBudget === 'cheap',
            date: day.date,
            currency: trip.currency,
            limit: 20,
          });

          if (candidates.length === 0) return;

          const ranked = await tasteProvider.rankFood(
            candidates,
            trip.preferences,
            `Day ${day.date} in ${trip.city ?? trip.title}`,
          );

          // Enrich the top picks with signature-dish suggestions (live LLM when
          // keyed; otherwise keeps any curated dishes already on the place).
          const cityName = trip.city ?? trip.title;
          let enriched = ranked;
          try {
            const dishMap = await tasteProvider.suggestDishes(ranked.slice(0, 8), cityName);
            enriched = ranked.map((p) =>
              dishMap[p.id]?.length ? { ...p, dishes: dishMap[p.id] } : p,
            );
          } catch {
            /* dishes are a nice-to-have; ignore failures */
          }

          foodByDate[day.date] = enriched;
        } catch {
          // Skip food for this day rather than failing the whole itinerary
        }
      }),
    );
  }

  // ── (d) Optimize ─────────────────────────────────────────────────────────
  let result: ItineraryResult;
  try {
    result = optimizeItinerary({
      trip,
      travel,
      weatherByDate: Object.keys(weatherByDate).length > 0 ? weatherByDate : undefined,
      foodByDate: Object.keys(foodByDate).length > 0 ? foodByDate : undefined,
      now: opts?.now,
    });
  } catch {
    // Absolute last resort: run optimizer with no enrichment data
    result = optimizeItinerary({ trip });
  }

  // ── (e) Transit detail (display-only) ──────────────────────────────────────
  // For transit/mixed trips, fetch per-line Directions detail (line, colour,
  // vehicle, board/alight stations, stop count) and attach it to each leg.
  if (!aborted()) {
    try {
      await enrichTransitDetail(result, trip.preferences.transport, opts?.signal);
    } catch {
      // Transit detail is a nice-to-have; never fail the plan for it.
    }
  }

  return result;
}

/**
 * Attach per-line transit detail to each travel leg of a finished itinerary.
 * The optimizer routes on a Distance-Matrix time matrix (no step detail); here
 * we issue a bounded set of Directions calls (which DO return transit_details)
 * and decorate the legs in place. No-ops offline or for non-transit trips.
 */
async function enrichTransitDetail(
  result: ItineraryResult,
  mode: TransportMode,
  signal?: AbortSignal,
): Promise<void> {
  if ((mode !== 'transit' && mode !== 'mixed') || !features.livePlaces) return;

  const MAX_LEGS = 40; // hard cap on Directions calls per generation
  type Task = { from: LatLng; to: LatLng; apply: (steps: TransitStep[]) => void };
  const tasks: Task[] = [];

  for (const day of result.days) {
    let prev: LatLng | undefined = day.startLocation;
    for (const stop of day.stops) {
      const leg = stop.legToHere;
      if (prev && leg) {
        tasks.push({ from: prev, to: stop.place.location, apply: (s) => { leg.transit = s; } });
      }
      prev = stop.place.location;
    }
    if (prev && day.endLeg && day.endLocation) {
      const leg = day.endLeg;
      tasks.push({ from: prev, to: day.endLocation, apply: (s) => { leg.transit = s; } });
    }
  }

  await Promise.allSettled(
    tasks.slice(0, MAX_LEGS).map(async (t) => {
      if (signal?.aborted) return;
      const detailed = await routingProvider.leg(t.from, t.to, mode);
      if (detailed.transit && detailed.transit.length) t.apply(detailed.transit);
    }),
  );
}
