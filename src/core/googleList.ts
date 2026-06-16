/**
 * Pure helpers for understanding Google Maps URLs. The *resolution* of a shared
 * list into places needs the network (see services/places), but recognising the
 * link type and extracting coordinates from a single-place link is pure logic.
 */

import type { LatLng } from './types';

const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl'];

export type GoogleUrlKind = 'list' | 'place' | 'short' | 'directions' | 'unknown';

/** Classify a Google Maps URL so the importer knows how to handle it. */
export function classifyGoogleUrl(url: string): GoogleUrlKind {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'unknown';
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (SHORT_HOSTS.includes(host)) return 'short';
  if (!/google\./.test(host) && host !== 'maps.google.com') return 'unknown';

  const path = parsed.pathname;
  if (/\/maps\/dir\//.test(path)) return 'directions';
  // Saved / shared lists carry these markers.
  if (/\/maps\/(@|place\/.*\/data=.*!4m|placelists|@.*data)/.test(path) || /entry=tts|g_ep|shorturl/.test(parsed.search)) {
    if (/\/maps\/place\//.test(path)) return 'place';
  }
  if (/\/maps\/place\//.test(path)) return 'place';
  if (/list|saved|contrib|placelists/.test(path + parsed.search)) return 'list';
  return 'unknown';
}

export function isGoogleMapsUrl(url: string): boolean {
  return classifyGoogleUrl(url) !== 'unknown';
}

/**
 * Pull a coordinate out of a single-place URL. Handles the common forms:
 *   …/@38.7223,-9.1393,15z…
 *   …!3d38.7223!4d-9.1393…
 *   ?q=38.7223,-9.1393  /  ?query=38.7223,-9.1393
 */
export function parseCoordsFromUrl(url: string): LatLng | null {
  // !3d<lat>!4d<lng> (most precise — the actual pin)
  const bang = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url);
  if (bang) return { lat: Number(bang[1]), lng: Number(bang[2]) };

  // @<lat>,<lng>
  const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };

  // ?q= / ?query= / ?ll=
  try {
    const params = new URL(url).searchParams;
    for (const key of ['q', 'query', 'll', 'center']) {
      const v = params.get(key);
      const m = v && /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/.exec(v);
      if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    }
  } catch {
    /* not a parseable URL */
  }
  return null;
}

/** Extract the human-readable place name from a /maps/place/<name>/ URL. */
export function parsePlaceNameFromUrl(url: string): string | null {
  const m = /\/maps\/place\/([^/@]+)/.exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || null;
  } catch {
    return null;
  }
}
