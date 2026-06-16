import { optimizeItinerary } from '../src/core/optimizer';
import type { MealKind, OpeningHours, Place, Trip, TripPreferences } from '../src/core/types';

const allDay = (open: number, close: number): OpeningHours => ({
  weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ open, close }]])),
});

const attraction: Place = {
  id: 'att',
  name: 'Museum',
  location: { lat: 38.72, lng: -9.14 },
  category: 'museum',
  interests: ['culture'],
  dwellMinutes: 60,
  weatherSensitivity: 'indoor',
  openingHours: allDay(540, 1140),
  rating: 4.5,
};

const cafe: Place = {
  id: 'cafe',
  name: 'Café',
  location: { lat: 38.721, lng: -9.141 },
  category: 'cafe',
  interests: ['food'],
  dwellMinutes: 45,
  weatherSensitivity: 'indoor',
  openingHours: allDay(420, 1320), // 07:00–22:00
  rating: 4.4,
  isFood: true,
};

function trip(meals: MealKind[]): Trip {
  const prefs: TripPreferences = {
    interests: ['culture', 'food'],
    transport: 'walk',
    pace: 'balanced',
    includeFood: true,
    meals,
  };
  return {
    id: 't',
    title: 'Lisbon',
    currency: 'EUR',
    center: { lat: 38.7223, lng: -9.1393 },
    days: [{ date: '2026-06-17', startMinutes: 8 * 60, endMinutes: 22 * 60, startLocation: { lat: 38.7223, lng: -9.1393 } }],
    places: [attraction],
    preferences: prefs,
  };
}

describe('meal selection', () => {
  const food = { '2026-06-17': [cafe] };

  test('breakfast is inserted in the morning when requested', () => {
    const r = optimizeItinerary({ trip: trip(['breakfast']), foodByDate: food });
    const meals = r.days[0].stops.filter((s) => s.isFood);
    expect(meals.length).toBeGreaterThanOrEqual(1);
    expect(meals[0].arrivalMinutes).toBeLessThan(11 * 60); // morning
  });

  test('no meals are inserted when the meal list is empty', () => {
    const r = optimizeItinerary({ trip: trip([]), foodByDate: food });
    expect(r.days[0].stops.some((s) => s.isFood)).toBe(false);
  });

  test('only the chosen meals appear (lunch only)', () => {
    const r = optimizeItinerary({ trip: trip(['lunch']), foodByDate: food });
    const meals = r.days[0].stops.filter((s) => s.isFood);
    expect(meals.length).toBe(1);
    expect(meals[0].arrivalMinutes).toBeGreaterThanOrEqual(12 * 60);
    expect(meals[0].arrivalMinutes).toBeLessThan(15 * 60);
  });
});
