/**
 * Integration: push the hand-curated datasets through the real optimizer to
 * prove the data layer and engine actually work together (not just compile).
 */
import {
  cityIdForCenter,
  findCity,
  getCityFood,
  getCityPlaces,
  getSampleSharedList,
  listCities,
} from '@/data';
import { isOpenAt, optimizeItinerary } from '@/core';
import type { Trip } from '@/core';

describe('data ↔ engine integration', () => {
  test('city catalog is well-formed', () => {
    const cities = listCities();
    expect(cities.length).toBeGreaterThanOrEqual(6);
    for (const c of cities) {
      expect(c.id).toBeTruthy();
      expect(Number.isFinite(c.center.lat)).toBe(true);
      expect(getCityPlaces(c.id).length).toBeGreaterThanOrEqual(8);
      expect(getCityFood(c.id).every((f) => f.isFood)).toBe(true);
    }
  });

  test('findCity resolves by name and cityIdForCenter round-trips', () => {
    const lisbon = findCity('Lisbon');
    expect(lisbon).toBeDefined();
    expect(lisbon!.currency).toBeTruthy();
    const id = cityIdForCenter(lisbon!.center);
    expect(id).toBe('lisbon');
  });

  test('sample shared list parses into valid places', () => {
    const list = getSampleSharedList();
    expect(list.places.length).toBeGreaterThan(0);
    expect(list.places.every((p) => p.id && p.name && Number.isFinite(p.location.lat))).toBe(true);
  });

  test('optimizes a real Lisbon day with feasible, in-window stops', () => {
    const places = getCityPlaces('lisbon');
    const trip: Trip = {
      id: 't',
      title: 'Lisbon',
      city: 'Lisbon',
      currency: 'EUR',
      center: findCity('Lisbon')!.center,
      days: [
        { date: '2026-06-17', startMinutes: 9 * 60, endMinutes: 19 * 60, startLocation: findCity('Lisbon')!.center },
        { date: '2026-06-18', startMinutes: 9 * 60, endMinutes: 19 * 60 },
      ],
      places,
      preferences: {
        interests: ['history', 'architecture', 'food'],
        transport: 'transit',
        pace: 'balanced',
        includeFood: false,
      },
    };

    const result = optimizeItinerary({ trip });
    expect(result.days).toHaveLength(2);
    const scheduled = result.days.flatMap((d) => d.stops);
    expect(scheduled.length).toBeGreaterThan(3);

    for (const day of result.days) {
      for (const stop of day.stops) {
        expect(stop.arrivalMinutes).toBeGreaterThanOrEqual(day.window.startMinutes);
        expect(stop.departureMinutes).toBeLessThanOrEqual(day.window.endMinutes);
        expect(isOpenAt(stop.place.openingHours, day.date, stop.arrivalMinutes)).toBe(true);
      }
      expect(day.googleMapsUrl).toMatch(/google\.com\/maps\/dir/);
    }

    // No place scheduled twice across the trip.
    const ids = scheduled.filter((s) => !s.isFood).map((s) => s.place.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('food candidates rank and slot in when enabled', () => {
    const trip: Trip = {
      id: 't2',
      title: 'Lisbon Food',
      currency: 'EUR',
      center: findCity('Lisbon')!.center,
      days: [{ date: '2026-06-17', startMinutes: 10 * 60, endMinutes: 22 * 60, startLocation: findCity('Lisbon')!.center }],
      places: getCityPlaces('lisbon'),
      preferences: {
        interests: ['food', 'history'],
        transport: 'walk',
        pace: 'relaxed',
        includeFood: true,
        foodBudget: 'mid',
      },
    };
    const result = optimizeItinerary({
      trip,
      foodByDate: { '2026-06-17': getCityFood('lisbon') },
    });
    const food = result.days[0].stops.filter((s) => s.isFood);
    expect(food.length).toBeGreaterThanOrEqual(1);
  });
});
