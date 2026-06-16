/**
 * generateItinerary — high-level orchestrator the UI calls.
 *
 * Wires together all four providers (places, routing, weather, taste) and the
 * pure core optimizer. Every provider failure is caught; the optimizer always
 * gets at least haversine travel estimates so it can produce a result even
 * when the device is fully offline.
 */

import type { ItineraryResult, LatLng, Place, Trip } from '@/core';
import { centroid, estimateLeg, optimizeItinerary } from '@/core';
import type { TravelFn } from '@/core/optimizer';
import { placesProvider } from './places';
import { routingProvider, buildTravelFn } from './routing';
import { weatherProvider } from './weather';
import { tasteProvider } from './llm';

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
            date: day.date,
            limit: 20,
          });

          if (candidates.length === 0) return;

          const ranked = await tasteProvider.rankFood(
            candidates,
            trip.preferences,
            `Day ${day.date} in ${trip.city ?? trip.title}`,
          );

          foodByDate[day.date] = ranked;
        } catch {
          // Skip food for this day rather than failing the whole itinerary
        }
      }),
    );
  }

  // ── (d) Optimize ─────────────────────────────────────────────────────────
  try {
    return optimizeItinerary({
      trip,
      travel,
      weatherByDate: Object.keys(weatherByDate).length > 0 ? weatherByDate : undefined,
      foodByDate: Object.keys(foodByDate).length > 0 ? foodByDate : undefined,
      now: opts?.now,
    });
  } catch {
    // Absolute last resort: run optimizer with no enrichment data
    return optimizeItinerary({ trip });
  }
}
