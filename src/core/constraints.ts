/**
 * Feasibility constraints: opening hours (with date-specific exceptions for
 * holidays / ceremonies / closures) and weather impact on outdoor places.
 *
 * These are the rules that stop the optimizer from sending you to a museum
 * that's shut on Mondays, or to a sun-baked viewpoint at 38 °C.
 */

import { dayOfWeek } from './time';
import type {
  DayWeather,
  OpeningHours,
  Place,
  TimeRange,
  TripPreferences,
} from './types';

/** Resolve the concrete open ranges for a place on a specific date. */
export function openRangesForDate(
  hours: OpeningHours | undefined,
  isoDate: string,
): TimeRange[] {
  if (!hours || hours.alwaysOpen) return [{ open: 0, close: 1440 }];

  const exception = hours.exceptions?.find((e) => e.date === isoDate);
  if (exception) {
    if (exception.closed) return [];
    if (exception.ranges) return [...exception.ranges].sort((a, b) => a.open - b.open);
  }

  const ranges = hours.weekly[dayOfWeek(isoDate)] ?? [];
  return [...ranges].sort((a, b) => a.open - b.open);
}

/** Is the place open at a given minute-of-day on a given date? */
export function isOpenAt(
  hours: OpeningHours | undefined,
  isoDate: string,
  minutes: number,
): boolean {
  // No hours info → assume open (we can't prove otherwise).
  if (!hours) return true;
  return openRangesForDate(hours, isoDate).some(
    (r) => minutes >= r.open && minutes < r.close,
  );
}

export interface VisitFeasibility {
  feasible: boolean;
  /** When you actually enter (>= arrival, after any wait for opening). */
  entryMinutes: number;
  waitMinutes: number;
  /** entry + dwell. */
  departMinutes: number;
  reason?: 'closed-for-day' | 'day-window' | 'closes-during-visit';
}

/**
 * Can a `dwellMinutes` visit happen given an `arrivalMinutes` time, the place's
 * hours for that date, and the day's hard end time? Inserts a wait if we arrive
 * before opening, and rejects visits that can't finish before close / day end.
 */
export function evaluateVisit(
  hours: OpeningHours | undefined,
  isoDate: string,
  arrivalMinutes: number,
  dwellMinutes: number,
  dayEndMinutes: number,
): VisitFeasibility {
  // Unknown / always-open hours: only the day window constrains us.
  if (!hours || hours.alwaysOpen) {
    const depart = arrivalMinutes + dwellMinutes;
    return {
      feasible: depart <= dayEndMinutes,
      entryMinutes: arrivalMinutes,
      waitMinutes: 0,
      departMinutes: depart,
      reason: depart <= dayEndMinutes ? undefined : 'day-window',
    };
  }

  const ranges = openRangesForDate(hours, isoDate);
  if (ranges.length === 0) {
    return {
      feasible: false,
      entryMinutes: arrivalMinutes,
      waitMinutes: 0,
      departMinutes: arrivalMinutes + dwellMinutes,
      reason: 'closed-for-day',
    };
  }

  let sawClosesDuring = false;
  for (const r of ranges) {
    if (arrivalMinutes >= r.close) continue; // this range already over
    const entry = Math.max(arrivalMinutes, r.open);
    const depart = entry + dwellMinutes;
    if (depart > r.close) {
      sawClosesDuring = true;
      continue; // try a later range (rare, but multi-range days exist)
    }
    if (depart > dayEndMinutes) {
      return {
        feasible: false,
        entryMinutes: entry,
        waitMinutes: entry - arrivalMinutes,
        departMinutes: depart,
        reason: 'day-window',
      };
    }
    return {
      feasible: true,
      entryMinutes: entry,
      waitMinutes: entry - arrivalMinutes,
      departMinutes: depart,
    };
  }

  return {
    feasible: false,
    entryMinutes: arrivalMinutes,
    waitMinutes: 0,
    departMinutes: arrivalMinutes + dwellMinutes,
    reason: sawClosesDuring ? 'closes-during-visit' : 'closed-for-day',
  };
}

export interface WeatherImpact {
  /** Value multiplier in [0.2, 1.1]; <1 discourages, >1 (indoor refuge) encourages. */
  multiplier: number;
  warnings: string[];
}

const BAD_CONDITIONS = new Set(['rain', 'snow', 'storm']);

/**
 * How much the weather should push the optimizer toward/away from a place on a
 * given day. Indoor places become *more* attractive on bad days (refuge);
 * outdoor places lose value when it's too hot, too cold, or wet.
 */
export function weatherImpact(
  place: Place,
  weather: DayWeather | undefined,
  prefs: TripPreferences,
): WeatherImpact {
  const warnings: string[] = [];
  if (!weather) return { multiplier: 1, warnings };

  const sensitivity = place.weatherSensitivity;
  const wet =
    (prefs.weather?.avoidRain ?? true) &&
    (BAD_CONDITIONS.has(weather.condition) || weather.precipitationProbability >= 60);
  const hot =
    prefs.weather?.avoidOutdoorAboveC != null &&
    weather.tempMaxC > prefs.weather.avoidOutdoorAboveC;
  const cold =
    prefs.weather?.avoidOutdoorBelowC != null &&
    weather.tempMinC < prefs.weather.avoidOutdoorBelowC;

  if (sensitivity === 'indoor') {
    // Indoor venues are a good call when the weather is poor.
    const refuge = wet || hot || cold ? 1.1 : 1;
    return { multiplier: refuge, warnings };
  }

  const exposure = sensitivity === 'outdoor' ? 1 : 0.5; // mixed is half-exposed
  let multiplier = 1;

  if (wet) {
    multiplier *= 1 - 0.55 * exposure;
    warnings.push('Rain likely — mostly outdoors');
  }
  if (hot) {
    multiplier *= 1 - 0.4 * exposure;
    warnings.push(`Hot (${Math.round(weather.tempMaxC)}°C) — mostly outdoors`);
  }
  if (cold) {
    multiplier *= 1 - 0.4 * exposure;
    warnings.push(`Cold (${Math.round(weather.tempMinC)}°C) — mostly outdoors`);
  }

  return { multiplier: Math.max(0.2, multiplier), warnings };
}
