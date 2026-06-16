/**
 * Per-plan API cost model.
 *
 * One itinerary generation is NOT free when it runs on live data: it spends
 * Google Maps Platform units (the Distance Matrix dominates — it is O(n²) in the
 * number of routed points) plus a little LLM token cost for food ranking. This
 * module estimates that cost so credits can be charged in proportion to it,
 * rather than a flat "1 credit per plan" that under-prices large trips.
 *
 * Pricing model: **1 credit funds up to `USD_PER_CREDIT` of third-party API**.
 * A managed (hosted) generation is billed at its estimated cost rounded up to
 * whole credits (min 1, capped at `MAX_CREDITS_PER_PLAN`). Bring-your-own-key
 * users pay their provider directly and are never charged credits.
 *
 * Unit prices are Google Maps Platform + Anthropic list prices (USD, 2025),
 * rounded up so we never under-charge.
 */
import type { Trip } from './types';

/** USD list price per single API unit. */
export const API_UNIT_USD = {
  /** Distance Matrix: $5 / 1000 elements. */
  distanceMatrixElement: 0.005,
  /** Directions, transit (advanced) tier: ~$10 / 1000. */
  directionsTransitCall: 0.01,
  /** Nearby Search: $32 / 1000. */
  nearbySearch: 0.032,
  /** Place Details with reviews (basic + atmosphere): ~$22 / 1000. */
  placeDetails: 0.022,
  /** Place Photo: $7 / 1000. */
  placePhoto: 0.007,
  /** Haiku food ranking + dish suggestions per day (a few K tokens). */
  llmFoodRankPerDay: 0.004,
  // Open-Meteo weather is free.
} as const;

/**
 * API budget that one purchased credit funds. Sized so a typical 3-day / ~12-place
 * transit plan (~$1.9 of Google list cost, matrix-dominated) lands around 4 credits.
 * At low volume Google's $200/month free tier absorbs most of this, so the real
 * marginal cash cost per plan is just the LLM (~$0.02) — see docs/MONETIZATION.md.
 */
export const USD_PER_CREDIT = 0.5;

/** Cap on credits charged for a single plan, so the number stays friendly. */
export const MAX_CREDITS_PER_PLAN = 8;

export interface PlanCost {
  /** Distance Matrix element cost. */
  matrixUsd: number;
  /** Transit-detail Directions cost. */
  directionsUsd: number;
  /** Food Nearby-search cost. */
  foodUsd: number;
  /** LLM ranking/dish-suggestion cost. */
  llmUsd: number;
  /** Sum of the above. */
  totalUsd: number;
  /** Billable points in the routing matrix (n, capped at Google's 25). */
  matrixPoints: number;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Estimate the live-API cost (USD) of generating `trip`. */
export function estimatePlanCost(trip: Trip): PlanCost {
  const places = trip.places.filter((p) => !p.isFood).length;
  const days = Math.max(1, trip.days.length);
  const transit =
    trip.preferences.transport === 'transit' || trip.preferences.transport === 'mixed';
  const food = !!trip.preferences.includeFood;

  // Distance Matrix: one square matrix over every routed point (places + each
  // day's start/end), capped at Google's 25×25 limit.
  const matrixPoints = Math.min(25, places + days * 2);
  const matrixUsd = matrixPoints * matrixPoints * API_UNIT_USD.distanceMatrixElement;

  // Transit detail enrichment: ~one Directions call per scheduled leg.
  const transitLegs = transit ? places + days : 0;
  const directionsUsd = transitLegs * API_UNIT_USD.directionsTransitCall;

  // Food: one Nearby search per day.
  const foodUsd = food ? days * API_UNIT_USD.nearbySearch : 0;

  // LLM: food ranking + dish suggestions per day.
  const llmUsd = food ? days * API_UNIT_USD.llmFoodRankPerDay : 0;

  const totalUsd = round(matrixUsd + directionsUsd + foodUsd + llmUsd);
  return {
    matrixUsd: round(matrixUsd),
    directionsUsd: round(directionsUsd),
    foodUsd: round(foodUsd),
    llmUsd: round(llmUsd),
    totalUsd,
    matrixPoints,
  };
}

/** Whole credits to charge for one managed (hosted) generation of `trip`. */
export function creditsForPlan(trip: Trip): number {
  const { totalUsd } = estimatePlanCost(trip);
  const credits = Math.ceil(totalUsd / USD_PER_CREDIT);
  return Math.min(MAX_CREDITS_PER_PLAN, Math.max(1, credits));
}
