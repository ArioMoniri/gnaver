import { dayTips, placeTips } from '../src/core/constraints';
import { optimizeItinerary } from '../src/core/optimizer';
import type { DayWeather, OpeningHours, Place, Trip, TripPreferences } from '../src/core/types';

const allDay: OpeningHours = {
  weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ open: 480, close: 1320 }]])),
};

function place(id: string, over: Partial<Place> = {}): Place {
  return {
    id,
    name: id,
    location: { lat: 38.72 + Math.random() * 0.001, lng: -9.14 },
    category: 'museum',
    interests: ['culture'],
    dwellMinutes: 60,
    weatherSensitivity: 'indoor',
    openingHours: allDay,
    rating: 4.5,
    ...over,
  };
}

const prefs: TripPreferences = {
  interests: ['culture'],
  transport: 'walk',
  pace: 'balanced',
  includeFood: false,
};

describe('advisory tips', () => {
  test('religious places advise modest dress', () => {
    const church = place('c', { category: 'religious', interests: ['religion'] });
    expect(placeTips(church).join(' ')).toMatch(/modestly/i);
  });

  test('beach places advise gear; museums get none weather-free', () => {
    expect(placeTips(place('b', { category: 'beach' })).join(' ')).toMatch(/swimwear/i);
    expect(placeTips(place('m'))).toEqual([]);
  });

  test('rainy day advises an umbrella; hot day advises hydration', () => {
    const rain: DayWeather = { date: 'x', tempMinC: 12, tempMaxC: 18, precipitationProbability: 80, condition: 'rain' };
    const hot: DayWeather = { date: 'x', tempMinC: 24, tempMaxC: 36, precipitationProbability: 0, condition: 'clear' };
    expect(dayTips(rain).join(' ')).toMatch(/umbrella/i);
    expect(dayTips(hot).join(' ')).toMatch(/hydrated|sun/i);
    expect(dayTips(undefined)).toEqual([]);
  });

  test('a scheduled religious stop carries its tip', () => {
    const trip: Trip = {
      id: 't',
      title: 'x',
      currency: 'EUR',
      days: [{ date: '2026-06-17', startMinutes: 9 * 60, endMinutes: 18 * 60, startLocation: { lat: 38.72, lng: -9.14 } }],
      places: [place('church', { category: 'religious', interests: ['religion', 'culture'] })],
      preferences: prefs,
    };
    const stop = optimizeItinerary({ trip }).days[0].stops[0];
    expect(stop.tips?.join(' ')).toMatch(/modestly/i);
  });
});

describe('refit places into another day/time', () => {
  test('places that overflow one day get fitted across the available days', () => {
    // 4 one-hour visits, two 3-hour days → everything should fit (none unscheduled).
    const places = ['a', 'b', 'c', 'd'].map((id) => place(id));
    const trip: Trip = {
      id: 't',
      title: 'x',
      currency: 'EUR',
      center: { lat: 38.72, lng: -9.14 },
      days: [
        { date: '2026-06-17', startMinutes: 10 * 60, endMinutes: 13 * 60, startLocation: { lat: 38.72, lng: -9.14 } },
        { date: '2026-06-18', startMinutes: 10 * 60, endMinutes: 13 * 60, startLocation: { lat: 38.72, lng: -9.14 } },
      ],
      places,
      preferences: prefs,
    };
    const result = optimizeItinerary({ trip });
    const scheduled = result.days.flatMap((d) => d.stops.map((s) => s.place.id));
    expect(result.unscheduled).toHaveLength(0);
    expect(new Set(scheduled).size).toBe(4);
  });
});
