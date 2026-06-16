/**
 * PlacesProvider implementation.
 *
 * Live path: Google Geocoding, Places (legacy JSON), Place Details APIs.
 * Mock path: curated @/data dataset — always works offline.
 *
 * Every public method is try/catch wrapped and NEVER throws to the caller.
 */

import type {
  CitySuggestion,
  FoodSearchParams,
  GeocodedPoint,
  Interest,
  LatLng,
  ParsedList,
  Place,
  PlaceCategory,
  PlaceDetails,
  PlaceReview,
  PlaceSearchParams,
  PlacesProvider,
  PriceInfo,
  ResolvedCity,
  WeatherSensitivity,
} from '@/core';
import {
  classifyGoogleUrl,
  currencyForCountry,
  parseCoordsFromUrl,
  parsePlaceNameFromUrl,
  rankFoodHeuristic,
} from '@/core';
import { findCity, listCities, cityIdForCenter, getCityPlaces, getCityFood, getSampleSharedList } from '@/data';
import { serviceConfig, features } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 12_000;

function withTimeout(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

async function gFetch<T>(url: string): Promise<T> {
  const controller = withTimeout(TIMEOUT_MS);
  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google type/category mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Map Google Places types to our PlaceCategory (first match wins). */
function typesToCategory(types: string[]): PlaceCategory {
  const set = new Set(types);
  if (set.has('restaurant') || set.has('food')) return 'restaurant';
  if (set.has('cafe') || set.has('bakery')) return 'cafe';
  if (set.has('bar') || set.has('night_club')) return 'bar';
  if (set.has('museum')) return 'museum';
  if (set.has('art_gallery')) return 'gallery';
  if (set.has('park') || set.has('natural_feature')) return 'park';
  if (set.has('beach')) return 'beach';
  if (set.has('church') || set.has('place_of_worship') || set.has('mosque') || set.has('synagogue')) return 'religious';
  if (set.has('shopping_mall') || set.has('store') || set.has('clothing_store')) return 'shopping';
  if (set.has('tourist_attraction') || set.has('amusement_park')) return 'landmark';
  if (set.has('cemetery') || set.has('historic') || set.has('ruins')) return 'historic';
  if (set.has('market') || set.has('grocery_or_supermarket')) return 'market';
  if (set.has('point_of_interest')) return 'landmark';
  return 'other';
}

/** Map Google types to our Interest tags. */
function typesToInterests(types: string[]): Interest[] {
  const set = new Set(types);
  const interests: Interest[] = [];
  if (set.has('museum') || set.has('art_gallery')) interests.push('culture', 'art');
  if (set.has('church') || set.has('place_of_worship')) interests.push('religion', 'history');
  if (set.has('tourist_attraction') || set.has('historic')) interests.push('history', 'culture');
  if (set.has('park') || set.has('natural_feature')) interests.push('nature');
  if (set.has('beach')) interests.push('beach', 'nature');
  if (set.has('shopping_mall') || set.has('store')) interests.push('shopping');
  if (set.has('bar') || set.has('night_club')) interests.push('nightlife');
  if (set.has('restaurant') || set.has('cafe') || set.has('food')) interests.push('food');
  // Deduplicate
  return [...new Set(interests)];
}

/** Best-effort dwell time based on category. */
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
    case 'street-food': return 20;
    case 'market': return 45;
    case 'shopping': return 60;
    case 'nightlife': return 90;
    case 'viewpoint': return 30;
    case 'nature': return 75;
    case 'experience': return 90;
    default: return 45;
  }
}

/** Weather sensitivity heuristic by category. */
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

/** Map Google price_level (0-4) to an approximate PriceInfo tier in `currency`. */
function priceLevel(level: number | undefined, currency = 'USD'): PriceInfo | undefined {
  if (level == null) return undefined;
  // Tier midpoints, scaled for zero-decimal currencies (JPY etc.) so ¥ amounts
  // read sensibly rather than ¥10.
  const base: Record<number, number | null> = { 0: 0, 1: 10, 2: 25, 3: 50, 4: 100 };
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'CLP', 'ISK']);
  const scale = zeroDecimal.has(currency) ? 130 : 1;
  const raw = base[level] ?? null;
  return {
    amount: raw == null ? null : raw * scale,
    currency,
    free: level === 0,
    acceptedPayments: ['card', 'cash'],
    notes: 'Approx. — live price tier',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Opening Hours → our OpeningHours.weekly
// ─────────────────────────────────────────────────────────────────────────────

interface GooglePeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

function parseGoogleHours(
  periods: GooglePeriod[] | undefined,
): Place['openingHours'] | undefined {
  if (!periods || periods.length === 0) return undefined;
  // 24/7 sentinel: single period open day 0 time "0000" with no close.
  if (periods.length === 1 && !periods[0].close) return { weekly: {}, alwaysOpen: true };

  const weekly: Partial<Record<number, Array<{ open: number; close: number }>>> = {};
  for (const p of periods) {
    const openMin = parseTime(p.open.time);
    const closeMin = p.close ? parseTime(p.close.time) : 24 * 60;
    // If close day > open day (runs past midnight), extend close past 1440.
    const extra = p.close && p.close.day !== p.open.day ? 24 * 60 : 0;
    const day = p.open.day;
    if (!weekly[day]) weekly[day] = [];
    weekly[day]!.push({ open: openMin, close: closeMin + extra });
  }
  return { weekly };
}

function parseTime(hhmm: string): number {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(2), 10);
  return h * 60 + m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google result → Place
// ─────────────────────────────────────────────────────────────────────────────

interface GooglePlaceResult {
  place_id: string;
  name: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  vicinity?: string;
  formatted_address?: string;
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: {
    periods?: GooglePeriod[];
    open_now?: boolean;
  };
}

/** Build a Google Place Photo URL from a photo_reference. */
function placePhotoUrl(ref: string, maxwidth = 800): string {
  return (
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${maxwidth}&photoreference=${ref}&key=${serviceConfig.googleApiKey}`
  );
}

/** A Google Maps deep link for a place (used as an offline / no-`url` fallback). */
function mapsSearchUrl(place: Place): string {
  const q = encodeURIComponent(place.name);
  return place.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.googlePlaceId}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Google Place Details `result` shape for the rich detail card (photos + reviews). */
interface GooglePlaceDetailsResult {
  rating?: number;
  user_ratings_total?: number;
  url?: string;
  formatted_address?: string;
  opening_hours?: { open_now?: boolean };
  photos?: Array<{ photo_reference: string }>;
  reviews?: Array<{
    author_name?: string;
    rating?: number;
    text?: string;
    relative_time_description?: string;
    profile_photo_url?: string;
    author_url?: string;
  }>;
}

function googleResultToPlace(r: GooglePlaceResult, isFood = false, currency = 'USD'): Place {
  const types = r.types ?? [];
  const category = typesToCategory(types);
  return {
    id: r.place_id,
    name: r.name,
    location: {
      lat: r.geometry?.location.lat ?? 0,
      lng: r.geometry?.location.lng ?? 0,
    },
    category,
    interests: typesToInterests(types),
    rating: r.rating,
    userRatingsTotal: r.user_ratings_total,
    price: priceLevel(r.price_level, currency),
    openingHours: parseGoogleHours(r.opening_hours?.periods),
    dwellMinutes: dwellByCategory(category),
    weatherSensitivity: weatherSensitivityByCategory(category),
    address: r.formatted_address ?? r.vicinity,
    googlePlaceId: r.place_id,
    photoUrl: r.photos?.[0] ? placePhotoUrl(r.photos[0].photo_reference, 800) : undefined,
    isFood: isFood || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Geocoding → ResolvedCity
// ─────────────────────────────────────────────────────────────────────────────

interface GeocodingResult {
  address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
  geometry: { location: { lat: number; lng: number } };
  formatted_address?: string;
  place_id: string;
}

interface GeocodingResponse {
  status: string;
  results: GeocodingResult[];
}

function geocodingToCity(r: GeocodingResult): ResolvedCity {
  let city = '';
  let country = '';
  let countryCode = '';
  for (const c of r.address_components) {
    if (c.types.includes('locality') || c.types.includes('postal_town')) city ||= c.long_name;
    if (c.types.includes('administrative_area_level_1') && !city) city = c.long_name;
    if (c.types.includes('country')) {
      country = c.long_name;
      countryCode = c.short_name;
    }
  }
  return {
    city: city || 'Unknown',
    country: country || 'Unknown',
    center: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
    currency: currencyForCountry(countryCode) ?? 'USD',
    timezone: 'UTC',
    countryCode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Short-link expansion (maps.app.goo.gl)
// ─────────────────────────────────────────────────────────────────────────────

async function expandShortLink(url: string): Promise<string> {
  const controller = withTimeout(TIMEOUT_MS);
  // Follow the redirect chain. React Native's fetch follows redirects by default.
  // We read the final URL via Response.url.
  const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
  return res.url || url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider implementation
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api';

export const placesProvider: PlacesProvider = {
  name: features.livePlaces ? 'google' : 'mock',

  // ── resolveCity ─────────────────────────────────────────────────────────
  async resolveCity(query: string): Promise<ResolvedCity | null> {
    if (features.livePlaces) {
      try {
        const encoded = encodeURIComponent(query);
        const url = `${GOOGLE_PLACES_BASE}/geocode/json?address=${encoded}&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<GeocodingResponse>(url);
        if (data.status === 'OK' && data.results.length > 0) {
          return geocodingToCity(data.results[0]);
        }
      } catch {
        // fall through to mock
      }
    }
    return findCity(query) ?? null;
  },

  // ── autocompleteCities (type-ahead dropdown) ─────────────────────────────
  async autocompleteCities(query: string): Promise<CitySuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    if (features.livePlaces) {
      try {
        const url =
          `${GOOGLE_PLACES_BASE}/place/autocomplete/json?input=${encodeURIComponent(q)}` +
          `&types=(cities)&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<{
          status: string;
          predictions: Array<{ description: string; place_id: string }>;
        }>(url);
        if (data.status === 'OK') {
          return data.predictions.slice(0, 6).map((p) => ({ label: p.description, id: p.place_id }));
        }
      } catch {
        // fall through to curated
      }
    }
    // Offline: curated cities matching the query (name or country).
    const lower = q.toLowerCase();
    return listCities()
      .filter((c) => c.name.toLowerCase().includes(lower) || c.country.toLowerCase().includes(lower))
      .slice(0, 6)
      .map((c) => ({ label: `${c.name}, ${c.country}`, id: c.id }));
  },

  // ── geocodeAddress (hotel / start-end point) ─────────────────────────────
  async geocodeAddress(query: string): Promise<GeocodedPoint | null> {
    const q = query.trim();
    if (!q) return null;
    if (features.livePlaces) {
      try {
        const url = `${GOOGLE_PLACES_BASE}/geocode/json?address=${encodeURIComponent(q)}&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<GeocodingResponse>(url);
        if (data.status === 'OK' && data.results.length > 0) {
          const r = data.results[0];
          return {
            location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
            label: r.formatted_address ?? q,
          };
        }
      } catch {
        // no offline geocoding for arbitrary addresses
      }
    }
    return null;
  },

  // ── search ──────────────────────────────────────────────────────────────
  async search(params: PlaceSearchParams): Promise<Place[]> {
    if (features.livePlaces) {
      try {
        const { center, radiusMeters = 5000, limit = 20 } = params;
        // Build a keyword string from interests
        const keyword = params.interests.join(' ') || 'tourist attraction';
        const url =
          `${GOOGLE_PLACES_BASE}/place/nearbysearch/json` +
          `?location=${center.lat},${center.lng}` +
          `&radius=${radiusMeters}` +
          `&keyword=${encodeURIComponent(keyword)}` +
          `&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<{ status: string; results: GooglePlaceResult[] }>(url);
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          return data.results.slice(0, limit).map((r) => googleResultToPlace(r, false, params.currency));
        }
      } catch {
        // fall through to mock
      }
    }
    // Mock: filter curated places by interest overlap
    const cityId = cityIdForCenter(params.center);
    const pool = cityId ? getCityPlaces(cityId) : [];
    const interests = new Set<Interest>(params.interests);
    const scored = pool
      .map((p) => ({
        p,
        score: p.interests.filter((i) => interests.has(i)).length + (p.rating ?? 0) / 5,
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
    return scored.slice(0, params.limit ?? 20);
  },

  // ── details ─────────────────────────────────────────────────────────────
  async details(googlePlaceId: string): Promise<Partial<Place> | null> {
    if (features.livePlaces) {
      try {
        const fields =
          'place_id,name,geometry,rating,user_ratings_total,price_level,types,' +
          'formatted_address,photos,opening_hours,editorial_summary';
        const url =
          `${GOOGLE_PLACES_BASE}/place/details/json` +
          `?place_id=${encodeURIComponent(googlePlaceId)}` +
          `&fields=${encodeURIComponent(fields)}` +
          `&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<{ status: string; result?: GooglePlaceResult }>(url);
        if (data.status === 'OK' && data.result) {
          return googleResultToPlace(data.result);
        }
      } catch {
        // fall through
      }
    }
    return null;
  },

  // ── placeDetails: photos + reviews for the in-app detail card ──────────────
  async placeDetails(place: Place): Promise<PlaceDetails> {
    const fallbackUrl = mapsSearchUrl(place);
    const offline = (): PlaceDetails => ({
      photos: place.photoUrl ? [place.photoUrl] : [],
      reviews: [],
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      googleMapsUrl: fallbackUrl,
      address: place.address,
      fromPlace: true,
    });

    if (!features.livePlaces || !place.googlePlaceId) return offline();

    try {
      const fields = 'rating,user_ratings_total,url,formatted_address,opening_hours,photos,reviews';
      const url =
        `${GOOGLE_PLACES_BASE}/place/details/json` +
        `?place_id=${encodeURIComponent(place.googlePlaceId)}` +
        `&fields=${encodeURIComponent(fields)}` +
        `&reviews_sort=most_relevant` +
        `&key=${serviceConfig.googleApiKey}`;
      const data = await gFetch<{ status: string; result?: GooglePlaceDetailsResult }>(url);
      if (data.status !== 'OK' || !data.result) return offline();
      const r = data.result;

      const photos = (r.photos ?? [])
        .slice(0, 8)
        .map((p) => placePhotoUrl(p.photo_reference, 1000));
      // Keep the curated/list photo first if Google returned none.
      if (photos.length === 0 && place.photoUrl) photos.push(place.photoUrl);

      const reviews: PlaceReview[] = (r.reviews ?? []).slice(0, 6).map((rv) => ({
        author: rv.author_name ?? 'Google user',
        rating: rv.rating ?? 0,
        text: rv.text ?? '',
        relativeTime: rv.relative_time_description,
        profilePhotoUrl: rv.profile_photo_url,
        authorUrl: rv.author_url,
      }));

      return {
        photos,
        reviews,
        rating: r.rating ?? place.rating,
        userRatingsTotal: r.user_ratings_total ?? place.userRatingsTotal,
        googleMapsUrl: r.url ?? fallbackUrl,
        address: r.formatted_address ?? place.address,
        openNow: r.opening_hours?.open_now,
        fromPlace: false,
      };
    } catch {
      return offline();
    }
  },

  // ── parseSharedList ──────────────────────────────────────────────────────
  async parseSharedList(url: string): Promise<ParsedList> {
    try {
      let resolved = url;
      const kind = classifyGoogleUrl(url);

      // Expand short links first
      if (kind === 'short') {
        try {
          resolved = await expandShortLink(url);
        } catch {
          // Use the sample list if we can't follow the redirect
          return { ...getSampleSharedList(), fromSample: true };
        }
      }

      const resolvedKind = classifyGoogleUrl(resolved);

      // Single place URL
      if (resolvedKind === 'place') {
        const name = parsePlaceNameFromUrl(resolved) ?? 'Saved Place';
        const coords = parseCoordsFromUrl(resolved);

        if (coords) {
          // Try to enrich with Details API
          let place: Place | null = null;
          if (features.livePlaces) {
            try {
              const encoded = encodeURIComponent(`${name}@${coords.lat},${coords.lng}`);
              const findUrl =
                `${GOOGLE_PLACES_BASE}/place/findplacefromtext/json` +
                `?input=${encoded}&inputtype=textquery` +
                `&locationbias=point:${coords.lat},${coords.lng}` +
                `&fields=place_id,name,geometry,rating,types` +
                `&key=${serviceConfig.googleApiKey}`;
              const data = await gFetch<{
                status: string;
                candidates?: GooglePlaceResult[];
              }>(findUrl);
              if (data.status === 'OK' && data.candidates?.length) {
                place = googleResultToPlace(data.candidates[0]);
              }
            } catch {
              // fall through to stub place
            }
          }

          if (!place) {
            place = {
              id: `parsed-${coords.lat}-${coords.lng}`,
              name,
              location: coords,
              category: 'landmark',
              interests: ['culture'],
              dwellMinutes: 45,
              weatherSensitivity: 'mixed',
            };
          }
          return { title: name, places: [place] };
        }
      }

      // For full list URLs — we cannot scrape Google Maps HTML reliably, so
      // fall back to the curated sample, flagged so the UI can disclose it.
      return { ...getSampleSharedList(), fromSample: true };
    } catch {
      return { ...getSampleSharedList(), fromSample: true };
    }
  },

  // ── suggestFood ──────────────────────────────────────────────────────────
  async suggestFood(params: FoodSearchParams): Promise<Place[]> {
    if (features.livePlaces) {
      try {
        const { near, limit = 15, budget } = params;
        const cuisine = params.cuisine?.join(' ') ?? '';
        const keyword = [cuisine, 'restaurant'].filter(Boolean).join(' ');
        const radius = 1500;

        // Price level: cheap=1, mid=2, fine=3|4
        const minPrice = budget === 'fine' ? 3 : budget === 'mid' ? 1 : 0;
        const maxPrice = budget === 'cheap' ? 1 : budget === 'mid' ? 2 : 4;

        const url =
          `${GOOGLE_PLACES_BASE}/place/nearbysearch/json` +
          `?location=${near.lat},${near.lng}` +
          `&radius=${radius}` +
          `&type=restaurant` +
          `&keyword=${encodeURIComponent(keyword)}` +
          `&minprice=${minPrice}` +
          `&maxprice=${maxPrice}` +
          `&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<{ status: string; results: GooglePlaceResult[] }>(url);
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          return data.results.slice(0, limit).map((r) => googleResultToPlace(r, true, params.currency));
        }
      } catch {
        // fall through to mock
      }
    }
    // Mock: return curated food places ranked heuristically
    const cityId = cityIdForCenter(params.near);
    const pool = cityId ? getCityFood(cityId) : [];
    // Create a minimal TripPreferences-like object for ranking
    const prefs = {
      interests: ['food' as Interest],
      transport: 'walk' as const,
      pace: 'balanced' as const,
      includeFood: true,
      foodBudget: params.budget,
      cuisinePrefs: params.cuisine,
      dietary: params.dietary,
    };
    return rankFoodHeuristic(pool, prefs).slice(0, params.limit ?? 15);
  },
};
