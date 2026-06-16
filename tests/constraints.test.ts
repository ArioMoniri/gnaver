import {
  evaluateVisit,
  isOpenAt,
  openRangesForDate,
  weatherImpact,
} from '../src/core/constraints';
import type { DayWeather, OpeningHours, Place, TripPreferences } from '../src/core/types';

// Museum: open Tue–Sun 10:00–18:00, closed Monday. (2026-06-16 = Tue, 06-15 = Mon)
const museum: OpeningHours = {
  weekly: {
    0: [{ open: 600, close: 1080 }],
    2: [{ open: 600, close: 1080 }],
    3: [{ open: 600, close: 1080 }],
    4: [{ open: 600, close: 1080 }],
    5: [{ open: 600, close: 1080 }],
    6: [{ open: 600, close: 1080 }],
  },
  exceptions: [{ date: '2026-06-16', closed: true, note: 'City ceremony' }],
};

describe('opening hours', () => {
  test('openRangesForDate respects weekly schedule and closed days', () => {
    expect(openRangesForDate(museum, '2026-06-17')).toEqual([{ open: 600, close: 1080 }]); // Wed
    expect(openRangesForDate(museum, '2026-06-15')).toEqual([]); // Mon, no schedule
  });

  test('date exceptions override the weekly schedule (ceremony closure)', () => {
    // Tuesday would normally be open, but the exception closes it.
    expect(openRangesForDate(museum, '2026-06-16')).toEqual([]);
    expect(isOpenAt(museum, '2026-06-16', 660)).toBe(false);
  });

  test('alwaysOpen and missing hours are treated as open', () => {
    expect(isOpenAt({ weekly: {}, alwaysOpen: true }, '2026-06-16', 30)).toBe(true);
    expect(isOpenAt(undefined, '2026-06-16', 30)).toBe(true);
  });
});

describe('evaluateVisit', () => {
  const dayEnd = 21 * 60;

  test('inserts a wait when arriving before opening', () => {
    const v = evaluateVisit(museum, '2026-06-17', 540, 60, dayEnd); // arrive 09:00
    expect(v.feasible).toBe(true);
    expect(v.waitMinutes).toBe(60);
    expect(v.entryMinutes).toBe(600);
    expect(v.departMinutes).toBe(660);
  });

  test('rejects a visit that would run past closing', () => {
    const v = evaluateVisit(museum, '2026-06-17', 1040, 60, dayEnd); // arrive 17:20, closes 18:00
    expect(v.feasible).toBe(false);
    expect(v.reason).toBe('closes-during-visit');
  });

  test('rejects arrival after closing', () => {
    const v = evaluateVisit(museum, '2026-06-17', 1100, 60, dayEnd);
    expect(v.feasible).toBe(false);
    expect(v.reason).toBe('closed-for-day');
  });

  test('rejects a visit that overruns the day window', () => {
    const v = evaluateVisit(undefined, '2026-06-17', 20 * 60 + 30, 60, dayEnd); // 20:30 + 60 > 21:00
    expect(v.feasible).toBe(false);
    expect(v.reason).toBe('day-window');
  });
});

describe('weather impact', () => {
  const prefs: TripPreferences = {
    interests: ['culture'],
    transport: 'walk',
    pace: 'balanced',
    includeFood: false,
    weather: { avoidOutdoorAboveC: 34, avoidOutdoorBelowC: 2, avoidRain: true },
  };
  const outdoor: Place = {
    id: 'view',
    name: 'Viewpoint',
    location: { lat: 0, lng: 0 },
    category: 'viewpoint',
    interests: ['photography'],
    dwellMinutes: 30,
    weatherSensitivity: 'outdoor',
  };
  const indoor: Place = { ...outdoor, id: 'm', category: 'museum', weatherSensitivity: 'indoor' };

  const hot: DayWeather = { date: 'x', tempMinC: 26, tempMaxC: 38, precipitationProbability: 5, condition: 'clear' };
  const rainy: DayWeather = { date: 'x', tempMinC: 12, tempMaxC: 18, precipitationProbability: 85, condition: 'rain' };

  test('outdoor places lose value in extreme heat', () => {
    const r = weatherImpact(outdoor, hot, prefs);
    expect(r.multiplier).toBeLessThan(1);
    expect(r.warnings.join(' ')).toMatch(/Hot/);
  });

  test('indoor places become a refuge on bad days', () => {
    expect(weatherImpact(indoor, rainy, prefs).multiplier).toBeGreaterThan(1);
  });

  test('rain penalises outdoor stops', () => {
    const r = weatherImpact(outdoor, rainy, prefs);
    expect(r.multiplier).toBeLessThan(0.6);
    expect(r.warnings.join(' ')).toMatch(/Rain/);
  });
});
