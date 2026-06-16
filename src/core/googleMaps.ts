/**
 * Build Google Maps deep links. Pure string logic so it's testable and shared
 * by both the "open in Google Maps" buttons and the copy-link feature.
 */

import type { LatLng, TransportMode } from './types';

const TRAVEL_MODE: Record<TransportMode, string> = {
  walk: 'walking',
  drive: 'driving',
  transit: 'transit',
  bike: 'bicycling',
  mixed: 'transit',
};

const coord = (p: LatLng): string => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/**
 * Directions through an ordered list of points using the path form of the
 * Maps URL, which supports many waypoints (unlike the `?api=1` form's 9 cap).
 * Returns an empty string for fewer than two points.
 */
export function buildDirectionsUrl(points: LatLng[], mode: TransportMode): string {
  const valid = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length < 2) return '';
  const path = valid.map(coord).join('/');
  return `https://www.google.com/maps/dir/${path}/?travelmode=${TRAVEL_MODE[mode]}`;
}

/** A pin link for a single place (prefers the canonical place id when known). */
export function buildPlaceUrl(location: LatLng, googlePlaceId?: string): string {
  if (googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${coord(location)}&query_place_id=${googlePlaceId}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${coord(location)}`;
}
