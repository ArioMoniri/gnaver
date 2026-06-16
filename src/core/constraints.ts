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
 * How much the weather should push the optimizer toward/away from a place at the
 * time it would actually be visited. When `visitHour` (0–23) is given and an
 * hourly forecast is available, the too-hot / too-cold / wet checks use the
 * forecast for THAT hour — so a sun-baked viewpoint loses value at 14:00 (38 °C)
 * but keeps it at 09:00 (24 °C), steering outdoor stops into the cool hours and
 * indoor refuges into the harsh ones (and vice-versa for cold mornings).
 */
export function weatherImpact(
  place: Place,
  weather: DayWeather | undefined,
  prefs: TripPreferences,
  visitHour?: number,
): WeatherImpact {
  const warnings: string[] = [];
  if (!weather) return { multiplier: 1, warnings };

  // Prefer the hour-of-visit forecast; fall back to the day's extremes.
  const hour = visitHour != null ? Math.max(0, Math.min(23, Math.floor(visitHour))) : undefined;
  const hourlyTemp = hour != null ? weather.hourlyTempC?.[hour] : undefined;
  const hourlyPrecip = hour != null ? weather.hourlyPrecipProb?.[hour] : undefined;
  const tempForHot = hourlyTemp ?? weather.tempMaxC;
  const tempForCold = hourlyTemp ?? weather.tempMinC;
  const precip = hourlyPrecip ?? weather.precipitationProbability;

  const sensitivity = place.weatherSensitivity;
  const wet =
    (prefs.weather?.avoidRain ?? true) &&
    (BAD_CONDITIONS.has(weather.condition) || precip >= 60);
  const hot =
    prefs.weather?.avoidOutdoorAboveC != null && tempForHot > prefs.weather.avoidOutdoorAboveC;
  const cold =
    prefs.weather?.avoidOutdoorBelowC != null && tempForCold < prefs.weather.avoidOutdoorBelowC;

  if (sensitivity === 'indoor') {
    // Indoor venues are a good call when the weather is poor at that hour.
    const refuge = wet || hot || cold ? 1.12 : 1;
    return { multiplier: refuge, warnings };
  }

  const exposure = sensitivity === 'outdoor' ? 1 : 0.5; // mixed is half-exposed
  let multiplier = 1;

  if (wet) {
    multiplier *= 1 - 0.55 * exposure;
    warnings.push('Rain likely — mostly outdoors');
  }
  if (hot) {
    multiplier *= 1 - 0.45 * exposure;
    warnings.push(`Hot (${Math.round(tempForHot)}°C) at this hour — mostly outdoors`);
  }
  if (cold) {
    multiplier *= 1 - 0.4 * exposure;
    warnings.push(`Cold (${Math.round(tempForCold)}°C) at this hour — mostly outdoors`);
  }

  return { multiplier: Math.max(0.2, multiplier), warnings };
}
