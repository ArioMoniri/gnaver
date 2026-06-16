import type { ResolvedCity, Place, LatLng } from '@/core';
import { haversineMeters } from '@/core';

export * from './cities';
import { CITIES, type CityMeta } from './cities';

import { lisbonPlaces, lisbonFood } from './lisbon';
import { parisPlaces, parisFood } from './paris';
import { romePlaces, romeFood } from './rome';
import { barcelonaPlaces, barcelonaFood } from './barcelona';
import { tokyoPlaces, tokyoFood } from './tokyo';
import { amsterdamPlaces, amsterdamFood } from './amsterdam';

// ─── Internal lookup maps ────────────────────────────────────────────────────

const PLACES_BY_CITY: Record<string, Place[]> = {
  lisbon: lisbonPlaces,
  paris: parisPlaces,
  rome: romePlaces,
  barcelona: barcelonaPlaces,
  tokyo: tokyoPlaces,
  amsterdam: amsterdamPlaces,
};

const FOOD_BY_CITY: Record<string, Place[]> = {
  lisbon: lisbonFood,
  paris: parisFood,
  rome: romeFood,
  barcelona: barcelonaFood,
  tokyo: tokyoFood,
  amsterdam: amsterdamFood,
};

/** Lowercase alias → city id */
const CITY_ALIASES: Record<string, string> = {
  'lisbon': 'lisbon',
  'lisboa': 'lisbon',
  'portugal': 'lisbon',
  'paris': 'paris',
  'france': 'paris',
  'île-de-france': 'paris',
  'ile-de-france': 'paris',
  'rome': 'rome',
  'roma': 'rome',
  'italy': 'rome',
  'italia': 'rome',
  'barcelona': 'barcelona',
  'bcn': 'barcelona',
  'spain': 'barcelona',
  'espana': 'barcelona',
  'españa': 'barcelona',
  'catalonia': 'barcelona',
  'tokyo': 'tokyo',
  'tōkyō': 'tokyo',
  'japan': 'tokyo',
  'nippon': 'tokyo',
  'amsterdam': 'amsterdam',
  'netherlands': 'amsterdam',
  'holland': 'amsterdam',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Returns the full list of supported cities. */
export function listCities(): CityMeta[] {
  return CITIES;
}

/**
 * Looks up a city by name, alias, or country.
 * Case-insensitive. Returns the first match as a ResolvedCity.
 */
export function findCity(query: string): ResolvedCity | undefined {
  const key = query.trim().toLowerCase();

  const directId = CITY_ALIASES[key];
  if (directId) {
    const meta = CITIES.find((c) => c.id === directId);
    if (meta) return metaToResolved(meta);
  }

  const partial = CITIES.find(
    (c) =>
      c.name.toLowerCase().includes(key) ||
      c.country.toLowerCase().includes(key) ||
      c.countryCode.toLowerCase() === key,
  );
  if (partial) return metaToResolved(partial);

  return undefined;
}

/**
 * Returns the id of the nearest CityMeta whose centre is within maxKm km.
 * Uses the haversine formula from @/core.
 */
export function cityIdForCenter(center: LatLng, maxKm = 60): string | undefined {
  const maxMeters = maxKm * 1000;
  let bestId: string | undefined;
  let bestDist = Infinity;

  for (const city of CITIES) {
    const dist = haversineMeters(center, city.center);
    if (dist < bestDist && dist <= maxMeters) {
      bestDist = dist;
      bestId = city.id;
    }
  }

  return bestId;
}

/**
 * Returns the list of attractions (non-food) for the given city id.
 * Returns [] for unknown city ids.
 */
export function getCityPlaces(cityId: string): Place[] {
  return PLACES_BY_CITY[cityId] ?? [];
}

/**
 * Returns the list of food places for the given city id.
 * Returns [] for unknown city ids.
 */
export function getCityFood(cityId: string): Place[] {
  return FOOD_BY_CITY[cityId] ?? [];
}

/**
 * Returns the list of must-try local dishes for the given city id.
 * Returns [] for unknown city ids.
 */
export function getLocalDishes(cityId: string): string[] {
  const meta = CITIES.find((c) => c.id === cityId);
  return meta ? meta.localDishes : [];
}

/**
 * Returns a believable demo "shared list" — as if a friend exported their
 * Lisbon saved-places from Google Maps and shared the link.
 */
export function getSampleSharedList(): { title: string; places: Place[] } {
  const places: Place[] = [
    lisbonPlaces.find((p) => p.id === 'lisbon-jeronimos')!,
    lisbonPlaces.find((p) => p.id === 'lisbon-belem-tower')!,
    lisbonPlaces.find((p) => p.id === 'lisbon-alfama')!,
    lisbonPlaces.find((p) => p.id === 'lisbon-lx-factory')!,
    lisbonPlaces.find((p) => p.id === 'lisbon-nacional-azulejo')!,
    lisbonFood.find((p) => p.id === 'lisbon-food-time-out-market')!,
    lisbonFood.find((p) => p.id === 'lisbon-food-pasteis-belem')!,
    lisbonFood.find((p) => p.id === 'lisbon-food-cervejaria-ramiro')!,
  ].filter(Boolean);

  return {
    title: 'Lisbon — saved by a friend 🇵🇹',
    places,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function metaToResolved(meta: CityMeta): ResolvedCity {
  return {
    city: meta.name,
    country: meta.country,
    center: meta.center,
    currency: meta.currency,
    timezone: meta.timezone,
    countryCode: meta.countryCode,
  };
}
