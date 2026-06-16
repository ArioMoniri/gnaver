import { creditsForPlan, estimatePlanCost, MAX_CREDITS_PER_PLAN, USD_PER_CREDIT } from '../src/core/cost';
import type { Place, Trip, TripPreferences } from '../src/core/types';

function makePlace(id: string): Place {
  return {
    id,
    name: id,
    location: { lat: 38.7, lng: -9.1 },
    category: 'landmark',
    interests: ['culture'],
    dwellMinutes: 60,
    weatherSensitivity: 'mixed',
  };
}

const prefs: TripPreferences = {
  interests: ['culture'],
  transport: 'transit',
  pace: 'balanced',
  includeFood: true,
};

function makeTrip(placeCount: number, dayCount: number, over: Partial<TripPreferences> = {}): Trip {
  return {
    id: 't',
    title: 'Trip',
    currency: 'EUR',
    days: Array.from({ length: dayCount }, (_, i) => ({
      date: `2026-06-${17 + i}`,
      startMinutes: 540,
      endMinutes: 1140,
    })),
    places: Array.from({ length: placeCount }, (_, i) => makePlace(`p${i}`)),
    preferences: { ...prefs, ...over },
  };
}

describe('plan cost model', () => {
  test('estimates a positive cost dominated by the distance matrix', () => {
    const c = estimatePlanCost(makeTrip(12, 3));
    expect(c.totalUsd).toBeGreaterThan(0);
    expect(c.matrixUsd).toBeGreaterThan(0);
    // The O(n²) matrix is the biggest single line item.
    expect(c.matrixUsd).toBeGreaterThanOrEqual(c.directionsUsd);
    expect(c.matrixUsd).toBeGreaterThanOrEqual(c.foodUsd);
  });

  test('cost grows with the number of places (more matrix elements)', () => {
    const small = estimatePlanCost(makeTrip(4, 1)).totalUsd;
    const large = estimatePlanCost(makeTrip(20, 1)).totalUsd;
    expect(large).toBeGreaterThan(small);
  });

  test('walking trips skip the transit Directions cost', () => {
    const transit = estimatePlanCost(makeTrip(10, 2, { transport: 'transit' }));
    const walk = estimatePlanCost(makeTrip(10, 2, { transport: 'walk' }));
    expect(transit.directionsUsd).toBeGreaterThan(0);
    expect(walk.directionsUsd).toBe(0);
  });

  test('credits are at least 1 and never exceed the cap', () => {
    expect(creditsForPlan(makeTrip(1, 1))).toBeGreaterThanOrEqual(1);
    const big = creditsForPlan(makeTrip(40, 7));
    expect(big).toBeLessThanOrEqual(MAX_CREDITS_PER_PLAN);
  });

  test('credits track the estimated USD cost / USD_PER_CREDIT', () => {
    const trip = makeTrip(12, 3);
    const expected = Math.min(
      MAX_CREDITS_PER_PLAN,
      Math.max(1, Math.ceil(estimatePlanCost(trip).totalUsd / USD_PER_CREDIT)),
    );
    expect(creditsForPlan(trip)).toBe(expected);
  });
});
