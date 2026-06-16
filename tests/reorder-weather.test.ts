import { weatherImpact } from '../src/core/constraints';
import { resequenceDay } from '../src/core/optimizer';
import type { DayWeather, DayWindow, OpeningHours, Place, TripPreferences } from '../src/core/types';

const everyDay = (open: number, close: number): OpeningHours => ({
  weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ open, close }]])),
});

const outdoor: Place = {
  id: 'view',
  name: 'Rooftop Viewpoint',
  location: { lat: 38.71, lng: -9.13 },
  category: 'viewpoint',
  interests: ['photography'],
  dwellMinutes: 45,
  weatherSensitivity: 'outdoor',
};

const prefs: TripPreferences = {
  interests: ['photography'],
  transport: 'walk',
  pace: 'balanced',
  includeFood: false,
  weather: { avoidOutdoorAboveC: 30, avoidOutdoorBelowC: 2, avoidRain: true },
};

// Cool morning, scorching afternoon.
const hourly = Array.from({ length: 24 }, (_, h) => (h >= 12 && h <= 17 ? 38 : 22));
const weather: DayWeather = {
  date: '2026-06-17',
  tempMinC: 20,
  tempMaxC: 38,
  precipitationProbability: 5,
  condition: 'clear',
  hourlyTempC: hourly,
};

describe('time-of-day weather', () => {
  test('outdoor stop is fine in the cool morning but penalised in the hot afternoon', () => {
    const morning = weatherImpact(outdoor, weather, prefs, 9);
    const afternoon = weatherImpact(outdoor, weather, prefs, 14);
    expect(morning.multiplier).toBe(1);
    expect(afternoon.multiplier).toBeLessThan(1);
    expect(afternoon.warnings.join(' ')).toMatch(/Hot \(38°C\) at this hour/);
  });

  test('indoor venue becomes a refuge precisely during the hot hours', () => {
    const indoor: Place = { ...outdoor, id: 'm', weatherSensitivity: 'indoor' };
    expect(weatherImpact(indoor, weather, prefs, 9).multiplier).toBe(1);
    expect(weatherImpact(indoor, weather, prefs, 14).multiplier).toBeGreaterThan(1);
  });

  test('falls back to day extremes when no visit hour is given', () => {
    const r = weatherImpact(outdoor, weather, prefs); // uses tempMaxC=38
    expect(r.multiplier).toBeLessThan(1);
  });
});

describe('resequenceDay (manual reorder)', () => {
  const a: Place = { ...outdoor, id: 'a', name: 'A', location: { lat: 38.72, lng: -9.14 }, openingHours: everyDay(540, 1200), weatherSensitivity: 'indoor' };
  const b: Place = { ...outdoor, id: 'b', name: 'B', location: { lat: 38.70, lng: -9.16 }, openingHours: everyDay(540, 1200), weatherSensitivity: 'indoor' };
  const c: Place = { ...outdoor, id: 'c', name: 'C', location: { lat: 38.73, lng: -9.12 }, openingHours: everyDay(540, 1200), weatherSensitivity: 'indoor' };
  const window: DayWindow = {
    date: '2026-06-17',
    startMinutes: 9 * 60,
    endMinutes: 19 * 60,
    startLocation: { lat: 38.7223, lng: -9.1393 },
  };

  test('honours the exact order it is given and re-times it', () => {
    const order = [c, a, b];
    const day = resequenceDay(order, window, prefs, { currency: 'EUR' });
    expect(day.stops.map((s) => s.place.id)).toEqual(['c', 'a', 'b']);
    // strictly increasing timeline
    for (let i = 1; i < day.stops.length; i++) {
      expect(day.stops[i].arrivalMinutes).toBeGreaterThanOrEqual(day.stops[i - 1].departureMinutes);
    }
    expect(day.googleMapsUrl).toMatch(/google\.com\/maps\/dir/);
  });

  test('keeps (not drops) a stop that is closed on the date and flags it', () => {
    const closedToday: Place = {
      ...a,
      id: 'closed',
      name: 'Closed Today',
      openingHours: {
        weekly: everyDay(540, 1200).weekly,
        exceptions: [{ date: '2026-06-17', closed: true, note: 'Holiday' }],
      },
    };
    const day = resequenceDay([closedToday, a], window, prefs, { currency: 'EUR' });
    expect(day.stops.map((s) => s.place.id)).toEqual(['closed', 'a']); // order respected, nothing dropped
    expect(day.stops[0].warnings?.join(' ')).toMatch(/closed/i);
  });
});
