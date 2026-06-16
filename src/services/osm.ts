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
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Nominatim's usage policy requires a descriptive UA identifying the app.
const USER_AGENT = 'gnaver-trip-planner/1.0 (https://github.com/ArioMoniri)';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

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

async function geocode(query: string, count: number): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `${GEOCODE_URL}?name=${encodeURIComponent(q)}` +
    `&count=${count}&language=en&format=json`;
  const data = await jsonFetch<{ results?: GeoResult[] }>(url);
  return data.results ?? [];
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
    const results = await geocode(query, 1);
    return results.length ? geoToCity(results[0]) : null;
  } catch {
    return null;
  }
}

/** Type-ahead city suggestions, e.g. "Siem Reap, Siem Reap, Cambodia". */
export async function osmAutocompleteCities(query: string): Promise<CitySuggestion[]> {
  try {
    const results = await geocode(query, 6);
    return results.map((r) => ({
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
  const data = await jsonFetch<{ elements?: OverpassElement[] }>(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  return data.elements ?? [];
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
  radiusMeters = 6000,
): Promise<Place[]> {
  try {
    const r = Math.round(radiusMeters);
    const at = `(around:${r},${center.lat.toFixed(5)},${center.lng.toFixed(5)})`;
    const query =
      `[out:json][timeout:25];(` +
      `nwr["tourism"~"^(attraction|museum|gallery|artwork|viewpoint|zoo|theme_park|aquarium)$"]["name"]${at};` +
      `nwr["historic"]["name"]${at};` +
      `nwr["leisure"~"^(park|garden|nature_reserve)$"]["name"]${at};` +
      `nwr["natural"="beach"]["name"]${at};` +
      `nwr["amenity"="place_of_worship"]["name"]["wikidata"]${at};` +
      `);out center 120;`;
    const elements = await overpass(query);
    const wanted = new Set<Interest>(interests);
    const scored = elements
      .map((el) => ({ el, place: elementToPlace(el, false) }))
      .filter((x): x is { el: OverpassElement; place: Place } => x.place !== null)
      .map((x) => ({
        place: x.place,
        score:
          prominence(x.el) +
          x.place.interests.filter((i) => wanted.has(i)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.place);
    return dedupeByName(scored).slice(0, limit);
  } catch {
    return [];
  }
}

/** Restaurants / cafés / bars around `near`. */
export async function osmSuggestFood(
  near: LatLng,
  cuisine: string[] | undefined,
  limit: number,
  radiusMeters = 1500,
): Promise<Place[]> {
  try {
    const r = Math.round(radiusMeters);
    const at = `(around:${r},${near.lat.toFixed(5)},${near.lng.toFixed(5)})`;
    const query =
      `[out:json][timeout:25];(` +
      `nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food)$"]["name"]${at};` +
      `);out center 80;`;
    const elements = await overpass(query);
    const cuisineLower = (cuisine ?? []).map((c) => c.toLowerCase());
    const scored = elements
      .map((el) => ({ el, place: elementToPlace(el, true) }))
      .filter((x): x is { el: OverpassElement; place: Place } => x.place !== null)
      .map((x) => {
        const tagCuisine = (x.el.tags?.cuisine ?? '').toLowerCase();
        const cuisineHit = cuisineLower.some((c) => tagCuisine.includes(c)) ? 2 : 0;
        return { place: x.place, score: cuisineHit + (x.el.tags?.wikidata ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.place);
    return dedupeByName(scored).slice(0, limit);
  } catch {
    return [];
  }
}
