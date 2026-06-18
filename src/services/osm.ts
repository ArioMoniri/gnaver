/**
 * Keyless OpenStreetMap places tier.
 *
 * Sits between Google (best, needs a key) and the bundled curated dataset
 * (always there, but a handful of cities). With NO key at all the app can still
 * resolve *any* city and plan a real itinerary — same philosophy as the weather
 * provider, which already runs on Open-Meteo for free.
 *
 *   • Geocoding (city → center, country, currency, timezone)   → Open-Meteo Geocoding
 *   • Free-form address / hotel geocoding                      → Nominatim (OSM)
 *   • Points of interest + food around a center                → Overpass (OSM)
 *
 * Every export is try/catch wrapped and NEVER throws: on any failure it returns
 * null / [] so the caller falls through to the curated dataset.
 */

import type {
  CitySuggestion,
  GeocodedPoint,
  Interest,
  LatLng,
  Place,
  PlaceCategory,
  ResolvedCity,
  WeatherSensitivity,
} from '@/core';
import { currencyForCountry } from '@/core';

const TIMEOUT_MS = 15_000;
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Overpass mirrors, tried in order — the main instance 406s/429s under load, so
// we fail over to public mirrors for resilience.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Per-mirror timeout. Mirrors are raced, so a slow one is abandoned, not waited on.
const OVERPASS_TIMEOUT_MS = 12_000;
// Nominatim's usage policy requires a descriptive UA identifying the app.
const USER_AGENT = 'gnaver-trip-planner/1.0 (https://github.com/ArioMoniri)';

async function jsonFetch<T>(url: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve with the first promise that fulfils; reject only if all reject. */
function firstSuccessful<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let pending = promises.length;
    if (pending === 0) {
      reject(new Error('no attempts'));
      return;
    }
    let settled = false;
    for (const p of promises) {
      p.then(
        (v) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        },
        () => {
          if (--pending === 0 && !settled) reject(new Error('all overpass mirrors failed'));
        },
      );
    }
  });
}

// Session caches so re-opening the same city (or re-generating) is instant.
const poiCache = new Map<string, Place[]>();
const foodCache = new Map<string, Place[]>();
const cacheKey = (p: LatLng, r: number, tag: string): string =>
  `${tag}:${p.lat.toFixed(3)},${p.lng.toFixed(3)}:${r}`;

// ─────────────────────────────────────────────────────────────────────────────
// Open-Meteo Geocoding — city name → place
// ─────────────────────────────────────────────────────────────────────────────

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}

async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `${GEOCODE_URL}?name=${encodeURIComponent(q)}` +
    `&count=10&language=en&format=json`;
  const data = await jsonFetch<{ results?: GeoResult[] }>(url);
  // Open-Meteo ranks by name match, so a hamlet literally named "Siem" outranks
  // "Siem Reap". For a travel planner, bias toward the better-known destination
  // by population (stable sort keeps the API order for ties / unknown pop).
  return [...(data.results ?? [])].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
}

function geoToCity(r: GeoResult): ResolvedCity {
  return {
    city: r.name,
    country: r.country || 'Unknown',
    center: { lat: r.latitude, lng: r.longitude },
    currency: currencyForCountry(r.country_code) ?? 'USD',
    timezone: r.timezone || 'auto',
    countryCode: r.country_code,
  };
}

/** Resolve a city name to its center, country, currency and timezone. */
export async function osmResolveCity(query: string): Promise<ResolvedCity | null> {
  try {
    const results = await geocode(query);
    return results.length ? geoToCity(results[0]) : null;
  } catch {
    return null;
  }
}

/** Type-ahead city suggestions, e.g. "Siem Reap, Siem Reap, Cambodia". */
export async function osmAutocompleteCities(query: string): Promise<CitySuggestion[]> {
  try {
    let results = await geocode(query);
    // "Phnom Penh, Cambodia" (iOS autofill appends the country) can geocode to
    // nothing — retry on just the city part so the suggestion still appears.
    if (results.length === 0 && query.includes(',')) {
      results = await geocode(query.split(',')[0].trim());
    }
    return results.slice(0, 6).map((r) => ({
      label: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : null, r.country]
        .filter(Boolean)
        .join(', '),
      id: `osm:${r.latitude},${r.longitude}`,
    }));
  } catch {
    return [];
  }
}

/** Geocode a free-form address / hotel name to a point (via Nominatim). */
export async function osmGeocodeAddress(query: string): Promise<GeocodedPoint | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`;
    const data = await jsonFetch<Array<{ lat: string; lon: string; display_name?: string }>>(
      url,
      { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } },
    );
    if (!data.length) return null;
    const r = data[0];
    return {
      location: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
      label: r.display_name ?? q,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overpass — points of interest around a center
// ─────────────────────────────────────────────────────────────────────────────

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Map OSM tags to our PlaceCategory (first match wins). */
function osmCategory(t: Record<string, string>): PlaceCategory {
  const tourism = t.tourism;
  if (t.amenity === 'restaurant' || t.amenity === 'fast_food') return 'restaurant';
  if (t.amenity === 'cafe' || t.shop === 'bakery') return 'cafe';
  if (t.amenity === 'bar' || t.amenity === 'pub' || t.amenity === 'nightclub') return 'bar';
  if (tourism === 'museum') return 'museum';
  if (tourism === 'gallery' || tourism === 'artwork') return 'gallery';
  if (t.amenity === 'place_of_worship' || t.building === 'church') return 'religious';
  if (t.leisure === 'park' || t.leisure === 'garden') return 'park';
  if (t.leisure === 'nature_reserve' || t.natural === 'wood') return 'nature';
  if (t.natural === 'beach') return 'beach';
  if (tourism === 'viewpoint') return 'viewpoint';
  if (t.historic) return 'historic';
  if (t.shop === 'mall' || t.shop === 'department_store') return 'shopping';
  if (t.amenity === 'marketplace') return 'market';
  if (tourism === 'attraction' || tourism === 'theme_park' || tourism === 'zoo' || tourism === 'aquarium')
    return 'landmark';
  return 'landmark';
}

const INTERESTS_BY_CATEGORY: Partial<Record<PlaceCategory, Interest[]>> = {
  museum: ['culture', 'art', 'history'],
  gallery: ['culture', 'art'],
  religious: ['religion', 'history'],
  historic: ['history', 'culture'],
  landmark: ['history', 'culture'],
  park: ['nature'],
  nature: ['nature'],
  beach: ['beach', 'nature'],
  viewpoint: ['nature'],
  shopping: ['shopping'],
  market: ['shopping', 'food'],
  bar: ['nightlife'],
  restaurant: ['food'],
  cafe: ['food'],
};

function dwellByCategory(category: PlaceCategory): number {
  switch (category) {
    case 'museum': return 90;
    case 'gallery': return 60;
    case 'landmark': return 45;
    case 'park': return 60;
    case 'beach': return 120;
    case 'religious': return 30;
    case 'historic': return 45;
    case 'restaurant': return 60;
    case 'cafe': return 30;
    case 'bar': return 45;
    case 'market': return 45;
    case 'shopping': return 60;
    case 'nightlife': return 90;
    case 'viewpoint': return 30;
    case 'nature': return 75;
    default: return 45;
  }
}

function weatherSensitivityByCategory(category: PlaceCategory): WeatherSensitivity {
  switch (category) {
    case 'museum':
    case 'gallery':
    case 'shopping':
    case 'bar':
    case 'nightlife':
    case 'restaurant':
    case 'cafe':
      return 'indoor';
    case 'park':
    case 'beach':
    case 'viewpoint':
    case 'nature':
      return 'outdoor';
    default:
      return 'mixed';
  }
}

function elementToPlace(el: OverpassElement, isFood: boolean): Place | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags['name:en'];
  if (!name) return null;
  const loc = el.lat != null && el.lon != null ? { lat: el.lat, lng: el.lon }
    : el.center ? { lat: el.center.lat, lng: el.center.lon }
    : null;
  if (!loc) return null;

  const category = osmCategory(tags);
  const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
    .filter(Boolean)
    .join(' ') || undefined;
  return {
    id: `osm-${el.type[0]}${el.id}`,
    name,
    location: loc,
    category,
    interests: INTERESTS_BY_CATEGORY[category] ?? ['culture'],
    dwellMinutes: dwellByCategory(category),
    weatherSensitivity: weatherSensitivityByCategory(category),
    address,
    photoUrl: /^https?:\/\//.test(tags.image ?? '') ? tags.image : undefined,
    // Carry the OSM cuisine tag so cached eateries can still be cuisine-ranked.
    tags: tags.cuisine ? tags.cuisine.split(';').map((s) => s.trim()).filter(Boolean) : undefined,
    isFood: isFood || undefined,
  };
}

/** Notability score so the best-known sights rise to the top. */
function prominence(el: OverpassElement): number {
  const t = el.tags ?? {};
  let s = 0;
  if (t.wikidata) s += 4;
  if (t.wikipedia) s += 2;
  if (t.tourism === 'attraction' || t.tourism === 'museum') s += 2;
  if (t.tourism || t.historic) s += 1;
  return s;
}

async function overpass(query: string): Promise<OverpassElement[]> {
  // Overpass's Apache front-end returns 406 Not Acceptable without an explicit
  // Accept header + a descriptive User-Agent, so both are required here.
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  };
  // Race every mirror — the public instances vary wildly in load (1s vs 30s), so
  // the fastest one to answer wins and a slow/erroring instance never blocks.
  const attempts = OVERPASS_URLS.map((url) =>
    jsonFetch<{ elements?: OverpassElement[] }>(url, init, OVERPASS_TIMEOUT_MS).then(
      (d) => d.elements ?? [],
    ),
  );
  return firstSuccessful(attempts);
}

function dedupeByName(places: Place[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const p of places) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Tourist points of interest around `center`, ranked by interest fit + fame. */
export async function osmSearchPlaces(
  center: LatLng,
  interests: Interest[],
  limit: number,
  // 8 km catches headline sights that sit outside the town centre (e.g. Angkor
  // Wat is ~6 km north of Siem Reap) while the lean query still returns in ~2-3s.
  radiusMeters = 8000,
): Promise<Place[]> {
  const r = Math.round(radiusMeters);
  const key = cacheKey(center, r, 'poi');
  const cached = poiCache.get(key);
  if (cached) return rankPoi(cached, interests, limit);
  try {
    const at = `(around:${r},${center.lat.toFixed(5)},${center.lng.toFixed(5)})`;
    // Lean query: notable POIs only. The broad `historic` scan is constrained to
    // wikidata-tagged (i.e. notable) sites — this is the difference between ~2s
    // and a 25s+ timeout, and still catches the headline sights (e.g. Angkor Wat,
    // tagged historic+wikidata). Worship/park-without-wikidata is dropped for
    // speed; major ones carry tourism/historic+wikidata tags and still appear.
    // `nw` (no relations) avoids expensive relation centroid computation.
    const query =
      `[out:json][timeout:12];(` +
      `nw["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]["name"]${at};` +
      `nw["historic"]["name"]["wikidata"]${at};` +
      `);out center 100;`;
    const elements = await overpass(query);
    // Cache the prominence-ranked superset; per-call interest weighting is applied
    // in rankPoi so a cached city re-ranks instantly for different interests.
    const ranked = elements
      .map((el) => ({ el, place: elementToPlace(el, false) }))
      .filter((x): x is { el: OverpassElement; place: Place } => x.place !== null)
      .sort((a, b) => prominence(b.el) - prominence(a.el))
      .map((x) => x.place);
    const deduped = dedupeByName(ranked);
    poiCache.set(key, deduped);
    return rankPoi(deduped, interests, limit);
  } catch {
    return [];
  }
}

/** Re-rank a cached POI superset by interest fit (cheap, no network). */
function rankPoi(places: Place[], interests: Interest[], limit: number): Place[] {
  const wanted = new Set<Interest>(interests);
  // Stable sort that nudges interest-matching places up without losing the
  // prominence order the list was cached in.
  return [...places]
    .map((p, i) => ({ p, i, fit: p.interests.filter((x) => wanted.has(x)).length }))
    .sort((a, b) => b.fit - a.fit || a.i - b.i)
    .map((x) => x.p)
    .slice(0, limit);
}

/** Restaurants / cafés / bars around `near`. */
export async function osmSuggestFood(
  near: LatLng,
  cuisine: string[] | undefined,
  limit: number,
  radiusMeters = 1500,
): Promise<Place[]> {
  const r = Math.round(radiusMeters);
  const key = cacheKey(near, r, 'food');
  const cached = foodCache.get(key);
  if (cached) return rankFood(cached, cuisine, limit);
  try {
    const at = `(around:${r},${near.lat.toFixed(5)},${near.lng.toFixed(5)})`;
    // nodes+ways only, capped, short timeout — eateries are dense so a tight
    // radius + low cap keeps this fast.
    const query =
      `[out:json][timeout:12];(` +
      `nw["amenity"~"^(restaurant|cafe|bar|pub|fast_food)$"]["name"]${at};` +
      `);out center 60;`;
    const elements = await overpass(query);
    const places = elements
      .map((el) => elementToPlace(el, true))
      .filter((p): p is Place => p !== null);
    const deduped = dedupeByName(places);
    foodCache.set(key, deduped);
    return rankFood(deduped, cuisine, limit);
  } catch {
    return [];
  }
}

/** Rank cached eateries by cuisine match (cheap, no network). */
function rankFood(places: Place[], cuisine: string[] | undefined, limit: number): Place[] {
  const cuisineLower = (cuisine ?? []).map((c) => c.toLowerCase());
  return [...places]
    .map((p, i) => {
      const tags = (p.tags ?? []).join(' ').toLowerCase();
      const hit = cuisineLower.some((c) => p.name.toLowerCase().includes(c) || tags.includes(c)) ? 1 : 0;
      return { p, i, hit };
    })
    .sort((a, b) => b.hit - a.hit || a.i - b.i)
    .map((x) => x.p)
    .slice(0, limit);
}
