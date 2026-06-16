/**
 * Geographic helpers and a synchronous travel-time estimator.
 *
 * The estimator is the fallback used by the optimizer when a real routing
 * matrix isn't available (offline, mock mode, or cache miss). Real providers
 * override these numbers with Google Directions data.
 */

import type { Bounds, LatLng, RouteLeg, TransportMode } from './types';

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two coordinates (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Real streets are longer than the crow flies. A 1.3× factor is a decent
 * urban approximation for walking/driving detours.
 */
const DETOUR_FACTOR = 1.3;

/** Effective travel speed in metres/minute, plus fixed overhead minutes. */
interface ModeProfile {
  metersPerMin: number;
  /** Fixed overhead: waiting for transit, parking a car, etc. */
  overheadMin: number;
}

const MODE_PROFILES: Record<TransportMode, ModeProfile> = {
  walk: { metersPerMin: 80, overheadMin: 0 }, // ~4.8 km/h
  bike: { metersPerMin: 230, overheadMin: 1 }, // ~13.8 km/h incl. locking up
  transit: { metersPerMin: 300, overheadMin: 6 }, // ~18 km/h incl. wait/transfer
  drive: { metersPerMin: 380, overheadMin: 5 }, // ~22.8 km/h urban incl. parking
  mixed: { metersPerMin: 80, overheadMin: 0 }, // resolved per-leg below
};

/**
 * Estimate a single travel leg without a network call. For `mixed`, short
 * hops walk and longer hops switch to transit — mirroring how people move.
 */
export function estimateLeg(from: LatLng, to: LatLng, mode: TransportMode): RouteLeg {
  const straight = haversineMeters(from, to);
  const distanceMeters = Math.round(straight * DETOUR_FACTOR);

  let effectiveMode: TransportMode = mode;
  if (mode === 'mixed') {
    effectiveMode = distanceMeters <= 1100 ? 'walk' : 'transit';
  }

  const profile = MODE_PROFILES[effectiveMode];
  const durationMinutes = Math.max(
    1,
    Math.round(distanceMeters / profile.metersPerMin + profile.overheadMin),
  );

  return { mode: effectiveMode, distanceMeters, durationMinutes };
}

/** Centre (mean) of a set of points. Returns null for an empty list. */
export function centroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** Bounding box covering all points (useful for fitting a map camera). */
export function boundsOf(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return { ne: { lat: north, lng: east }, sw: { lat: south, lng: west } };
}

/** Pad a bounds outward by a ratio (e.g. 0.2 for 20% margin). */
export function padBounds(b: Bounds, ratio: number): Bounds {
  const latPad = (b.ne.lat - b.sw.lat) * ratio || 0.01;
  const lngPad = (b.ne.lng - b.sw.lng) * ratio || 0.01;
  return {
    ne: { lat: b.ne.lat + latPad, lng: b.ne.lng + lngPad },
    sw: { lat: b.sw.lat - latPad, lng: b.sw.lng - lngPad },
  };
}
