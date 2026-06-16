/**
 * WeatherProvider — Open-Meteo (free, no key required).
 *
 * API docs: https://open-meteo.com/en/docs
 * Endpoint: GET https://api.open-meteo.com/v1/forecast
 *
 * On any error returns a mild mock (clear, 18–24 °C) so the optimizer
 * still has weather data and never throws.
 */

import type { DayWeather, LatLng, WeatherCondition, WeatherProvider } from '@/core';

const TIMEOUT_MS = 12_000;
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// ─────────────────────────────────────────────────────────────────────────────
// WMO Weather Interpretation Codes → WeatherCondition
// https://open-meteo.com/en/docs#weathervariables
// ─────────────────────────────────────────────────────────────────────────────

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'clouds';
  if (code >= 45 && code <= 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Open-Meteo response shape (minimal)
// ─────────────────────────────────────────────────────────────────────────────

interface OpenMeteoResponse {
  daily: {
    time: string[];                          // ISO dates
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weathercode: number[];
  };
  hourly: {
    time: string[];                          // ISO datetimes
    temperature_2m: number[];
    precipitation_probability: number[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock fallback
// ─────────────────────────────────────────────────────────────────────────────

function mildMock(date: string): DayWeather {
  return {
    date,
    tempMinC: 18,
    tempMaxC: 24,
    precipitationProbability: 10,
    condition: 'clear',
    hourlyTempC: Array.from({ length: 24 }, (_, h) =>
      18 + Math.round(6 * Math.sin(((h - 6) * Math.PI) / 12)),
    ),
    hourlyPrecipProb: Array(24).fill(10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const weatherProvider: WeatherProvider = {
  name: 'open-meteo',

  async forecast(center: LatLng, dates: string[]): Promise<DayWeather[]> {
    if (dates.length === 0) return [];

    try {
      const sorted = [...dates].sort();
      const startDate = sorted[0];
      const endDate = sorted[sorted.length - 1];

      const params = new URLSearchParams({
        latitude: center.lat.toFixed(4),
        longitude: center.lng.toFixed(4),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'weathercode',
        ].join(','),
        hourly: ['temperature_2m', 'precipitation_probability'].join(','),
        start_date: startDate,
        end_date: endDate,
        timezone: 'auto',
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let data: OpenMeteoResponse;
      try {
        const res = await fetch(`${BASE_URL}?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = (await res.json()) as OpenMeteoResponse;
      } finally {
        clearTimeout(timer);
      }

      const dateSet = new Set(dates);
      const results: DayWeather[] = [];

      for (let di = 0; di < data.daily.time.length; di++) {
        const date = data.daily.time[di];
        if (!dateSet.has(date)) continue;

        // Extract 24 hourly values for this calendar day
        const dayPrefix = date; // 'YYYY-MM-DD'
        const hourlyTempC: number[] = [];
        const hourlyPrecipProb: number[] = [];

        for (let hi = 0; hi < data.hourly.time.length; hi++) {
          if (data.hourly.time[hi].startsWith(dayPrefix)) {
            hourlyTempC.push(data.hourly.temperature_2m[hi]);
            hourlyPrecipProb.push(data.hourly.precipitation_probability[hi]);
          }
        }

        results.push({
          date,
          tempMaxC: data.daily.temperature_2m_max[di],
          tempMinC: data.daily.temperature_2m_min[di],
          precipitationProbability: data.daily.precipitation_probability_max[di] ?? 0,
          condition: wmoToCondition(data.daily.weathercode[di]),
          hourlyTempC: hourlyTempC.length === 24 ? hourlyTempC : undefined,
          hourlyPrecipProb: hourlyPrecipProb.length === 24 ? hourlyPrecipProb : undefined,
        });
      }

      // Any requested date not returned by Open-Meteo (too far in future?) → mock
      const gotDates = new Set(results.map((r) => r.date));
      for (const d of dates) {
        if (!gotDates.has(d)) results.push(mildMock(d));
      }

      return results;
    } catch {
      // Network failure, timeout, or parse error → mild mock for all dates
      return dates.map(mildMock);
    }
  },
};
