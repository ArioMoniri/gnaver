/**
 * RoutingProvider implementation.
 *
 * Live path: Google Directions (single leg) + Distance Matrix (pairwise).
 * Mock path: haversine estimateLeg from @/core/geo.
 *
 * buildTravelFn returns a SYNC TravelFn that the pure optimizer can call
 * without awaiting, closing over a pre-fetched routing matrix.
 */

import type { LatLng, RouteLeg, RoutingProvider, TransportMode } from '@/core';
import { estimateLeg, haversineMeters } from '@/core';
import { serviceConfig, features } from './config';
import type { TravelFn } from '@/core/optimizer';

const TIMEOUT_MS = 12_000;

function withTimeout(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

async function gFetch<T>(url: string): Promise<T> {
  const controller = withTimeout(TIMEOUT_MS);
  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';

// ─────────────────────────────────────────────────────────────────────────────
// Mode mapping: our TransportMode → Google travel_mode
// ─────────────────────────────────────────────────────────────────────────────

function toGoogleMode(mode: TransportMode): string {
  switch (mode) {
    case 'walk': return 'walking';
    case 'bike': return 'bicycling';
    case 'drive': return 'driving';
    case 'transit': return 'transit';
    case 'mixed': return 'transit'; // best effort
    default: return 'walking';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Directions response shapes (minimal)
// ─────────────────────────────────────────────────────────────────────────────

interface DirectionsLeg {
  distance: { value: number };   // metres
  duration: { value: number };   // seconds
}

interface DirectionsRoute {
  legs: DirectionsLeg[];
  overview_polyline?: { points: string };
}

interface DirectionsResponse {
  status: string;
  routes: DirectionsRoute[];
}

interface DistanceMatrixElement {
  status: string;
  distance: { value: number };
  duration: { value: number };
}

interface DistanceMatrixResponse {
  status: string;
  rows: Array<{ elements: DistanceMatrixElement[] }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decoding helpers
// ─────────────────────────────────────────────────────────────────────────────

function directionsToLeg(
  route: DirectionsRoute,
  mode: TransportMode,
): RouteLeg {
  const leg = route.legs[0];
  return {
    mode,
    distanceMeters: leg.distance.value,
    durationMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
  };
}

function matrixElementToLeg(
  el: DistanceMatrixElement,
  mode: TransportMode,
): RouteLeg {
  return {
    mode,
    distanceMeters: el.distance.value,
    durationMinutes: Math.max(1, Math.round(el.duration.value / 60)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const routingProvider: RoutingProvider = {
  name: features.livePlaces ? 'google' : 'estimate',

  // ── Single leg ────────────────────────────────────────────────────────────
  async leg(
    from: LatLng,
    to: LatLng,
    mode: TransportMode,
    _departMinutes?: number,
  ): Promise<RouteLeg> {
    if (features.livePlaces) {
      try {
        const gMode = toGoogleMode(mode);
        const url =
          `${GOOGLE_BASE}/directions/json` +
          `?origin=${from.lat},${from.lng}` +
          `&destination=${to.lat},${to.lng}` +
          `&mode=${gMode}` +
          `&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<DirectionsResponse>(url);
        if (data.status === 'OK' && data.routes.length > 0) {
          return directionsToLeg(data.routes[0], mode);
        }
      } catch {
        // fall through
      }
    }
    return estimateLeg(from, to, mode);
  },

  // ── Full pairwise matrix ──────────────────────────────────────────────────
  async matrix(points: LatLng[], mode: TransportMode): Promise<RouteLeg[][]> {
    const n = points.length;
    if (n === 0) return [];

    if (features.livePlaces && n <= 25) {
      // Google Distance Matrix supports up to 25 origins × 25 destinations
      try {
        const gMode = toGoogleMode(mode);
        const origins = points.map((p) => `${p.lat},${p.lng}`).join('|');
        const destinations = origins;
        const url =
          `${GOOGLE_BASE}/distancematrix/json` +
          `?origins=${encodeURIComponent(origins)}` +
          `&destinations=${encodeURIComponent(destinations)}` +
          `&mode=${gMode}` +
          `&key=${serviceConfig.googleApiKey}`;
        const data = await gFetch<DistanceMatrixResponse>(url);
        if (data.status === 'OK') {
          return data.rows.map((row, i) =>
            row.elements.map((el, j) => {
              if (el.status === 'OK') return matrixElementToLeg(el, mode);
              return estimateLeg(points[i], points[j], mode);
            }),
          );
        }
      } catch {
        // fall through to estimate
      }
    }

    // Fallback: compute full matrix with haversine estimator
    return points.map((from) =>
      points.map((to) => estimateLeg(from, to, mode)),
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// buildTravelFn — sync closure over a pre-fetched matrix
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a synchronous TravelFn for use in the pure optimizer.
 *
 * @param points  The ordered list of LatLngs used as row/column keys.
 * @param legs    The legs[i][j] matrix returned by routingProvider.matrix().
 *
 * Lookup is O(1) via a Map keyed on rounded coordinates. Cache misses fall
 * back to estimateLeg so the optimizer can never throw.
 */
export function buildTravelFn(points: LatLng[], legs: RouteLeg[][]): TravelFn {
  // Round to 5 decimal places (~1 m precision) to make floating-point keys safe.
  const key = (p: LatLng): string => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const cache = new Map<string, RouteLeg>();

  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (legs[i]?.[j]) {
        cache.set(`${key(points[i])}|${key(points[j])}`, legs[i][j]);
      }
    }
  }

  return (from: LatLng, to: LatLng, mode: TransportMode): RouteLeg => {
    const k = `${key(from)}|${key(to)}`;
    return cache.get(k) ?? estimateLeg(from, to, mode);
  };
}
