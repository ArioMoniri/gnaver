/**
 * Heuristic taste recommender. Used as the offline fallback for the TasteProvider
 * (when no LLM key is present) and to pre-rank candidates before sending a short
 * list to the LLM, keeping token cost low.
 */

import type { FoodBudget, Place, TripPreferences } from './types';

const BUDGET_RANK: Record<FoodBudget, number> = { cheap: 1, mid: 2, fine: 3 };

/** Rough price tier of a food place from its entry/typical price + category. */
function priceTier(place: Place): FoodBudget {
  const amount = place.price?.amount;
  if (amount != null) {
    if (amount <= 12) return 'cheap';
    if (amount <= 30) return 'mid';
    return 'fine';
  }
  if (place.category === 'street-food' || place.category === 'cafe') return 'cheap';
  if (place.category === 'restaurant') return 'mid';
  return 'mid';
}

function textHaystack(place: Place): string {
  return [place.name, place.description, ...(place.tags ?? [])].join(' ').toLowerCase();
}

/** Score a single food candidate against the traveller's taste. Exported for tests. */
export function scoreFood(place: Place, prefs: TripPreferences): number {
  let score = (place.rating ?? 3.8) * 2; // rating dominates

  const popularity = place.userRatingsTotal
    ? Math.min(2, Math.log10(place.userRatingsTotal + 1) / 2)
    : 0.4;
  score += popularity;

  const hay = textHaystack(place);

  // Cuisine preferences.
  if (prefs.cuisinePrefs?.length) {
    const matches = prefs.cuisinePrefs.filter((c) => hay.includes(c.toLowerCase())).length;
    score += matches * 1.5;
  }

  // Dietary needs: reward explicit support, gently penalise obvious conflicts.
  if (prefs.dietary?.length) {
    for (const need of prefs.dietary) {
      if (hay.includes(need.toLowerCase())) score += 1.2;
    }
    if (prefs.dietary.some((d) => /veg/i.test(d)) && /(steak|bbq|grill|carnivore)/i.test(hay)) {
      score -= 1.5;
    }
  }

  // Budget alignment: distance from desired tier costs points.
  if (prefs.foodBudget) {
    const diff = Math.abs(BUDGET_RANK[priceTier(place)] - BUDGET_RANK[prefs.foodBudget]);
    score -= diff * 1.2;
  }

  return score;
}

/** Rank food candidates best-first. Stable, deterministic, pure. */
export function rankFoodHeuristic(candidates: Place[], prefs: TripPreferences): Place[] {
  return candidates
    .map((place, index) => ({ place, index, score: scoreFood(place, prefs) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.place);
}

/** Sensible default weather thresholds derived from the traveller's interests. */
export function defaultWeatherPrefs(): TripPreferences['weather'] {
  return { avoidOutdoorAboveC: 34, avoidOutdoorBelowC: 2, avoidRain: true };
}
