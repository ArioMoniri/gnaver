/**
 * The map. Full-bleed Apple/Google map showing an ordered, numbered set of stops
 * connected by a route polyline, with the camera fit to the day's bounds.
 *
 *   iOS      → AppleMaps.View (numbered annotations + polyline)
 *   Android  → GoogleMaps.View (numbered markers + polyline)
 *   web/other→ a styled fallback card (no native map module)
 *
 * It must never crash: any stop missing a finite coordinate is skipped, and an
 * empty day renders a calm placeholder rather than throwing.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';

import { boundsOf, padBounds, type LatLng } from '@/core';
import { useTheme } from '@/theme';
import { Text, IconSymbol } from '@/components/ui';

export interface TripMapStop {
  id: string;
  location: LatLng;
  name: string;
  isFood?: boolean;
}

/** A labelled day endpoint (where the day starts or ends). */
export interface TripMapPin {
  lat: number;
  lng: number;
  label: string;
}

export interface TripMapProps {
  stops: TripMapStop[];
  /** Map centre fallback when there are no stops (e.g. the city centre). */
  center?: LatLng;
  /** Where the day begins — rendered as a distinct accent pin. */
  startPin?: TripMapPin;
  /** Where the day ends — rendered as a distinct graphite pin. */
  endPin?: TripMapPin;
  /** Bump this to re-fit / animate the camera (e.g. the active day index). */
  fitKey?: string | number;
  style?: StyleProp<ViewStyle>;
}

const isFinitePoint = (p: LatLng | undefined): p is LatLng =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** Derive a camera centre + zoom from a set of points. */
function cameraFor(points: LatLng[], fallback?: LatLng): { coordinates: { latitude: number; longitude: number }; zoom: number } {
  if (points.length === 0) {
    const c = fallback ?? { lat: 38.7223, lng: -9.1393 };
    return { coordinates: { latitude: c.lat, longitude: c.lng }, zoom: 12 };
  }
  const b = boundsOf(points);
  if (!b) {
    const c = points[0];
    return { coordinates: { latitude: c.lat, longitude: c.lng }, zoom: 14 };
  }
  const padded = padBounds(b, 0.25);
  const centerLat = (padded.ne.lat + padded.sw.lat) / 2;
  const centerLng = (padded.ne.lng + padded.sw.lng) / 2;
  const span = Math.max(padded.ne.lat - padded.sw.lat, (padded.ne.lng - padded.sw.lng) * 0.6, 0.002);
  // Rough log2 mapping of latitude span → tile zoom.
  const zoom = Math.max(3, Math.min(16, Math.round(Math.log2(360 / span)) - 1));
  return { coordinates: { latitude: centerLat, longitude: centerLng }, zoom };
}

const finitePin = (p: TripMapPin | undefined): p is TripMapPin =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

export function TripMap({ stops, center, startPin, endPin, fitKey, style }: TripMapProps) {
  const theme = useTheme();

  const valid = useMemo(() => stops.filter((s) => isFinitePoint(s.location)), [stops]);
  const start = useMemo(() => (finitePin(startPin) ? startPin : undefined), [startPin]);
  const end = useMemo(() => (finitePin(endPin) ? endPin : undefined), [endPin]);

  const points = useMemo(() => valid.map((s) => s.location), [valid]);
  // Fit the camera around the route *and* the day's start/end points.
  const fitPoints = useMemo(() => {
    const extra: LatLng[] = [];
    if (start) extra.push({ lat: start.lat, lng: start.lng });
    if (end) extra.push({ lat: end.lat, lng: end.lng });
    return [...points, ...extra];
  }, [points, start, end]);
  const camera = useMemo(() => cameraFor(fitPoints, center), [fitPoints, center]);

  const routeCoords = useMemo(
    () => points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points],
  );

  // ── iOS: AppleMaps ─────────────────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    return (
      <AppleMapsView
        valid={valid}
        startPin={start}
        endPin={end}
        routeCoords={routeCoords}
        camera={camera}
        fitKey={fitKey}
        routeColor={theme.colors.route}
        pinColor={theme.colors.pin}
        foodColor={theme.colors.pinFood}
        startColor={theme.colors.accent}
        endColor={theme.colors.textSecondary}
        scheme={theme.scheme}
        style={style}
      />
    );
  }

  // ── Android: GoogleMaps ──────────────────────────────────────────────────────
  if (Platform.OS === 'android') {
    return (
      <GoogleMapsView
        valid={valid}
        startPin={start}
        endPin={end}
        routeCoords={routeCoords}
        camera={camera}
        routeColor={theme.colors.route}
        pinColor={theme.colors.pin}
        foodColor={theme.colors.pinFood}
        scheme={theme.scheme}
        style={style}
      />
    );
  }

  // ── web / other: styled fallback ─────────────────────────────────────────────
  return (
    <View style={[styles.fallback, { backgroundColor: theme.colors.surfaceElevated }, style]}>
      <View style={[styles.fallbackInner, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.lg }]}>
        <IconSymbol name="map.fill" size={30} color={theme.colors.accent} fallbackGlyph="🗺" />
        <Text variant="subhead" weight="600" tone="accent" style={{ marginTop: 8 }}>
          {valid.length > 0 ? `${valid.length} stops mapped` : 'Map preview'}
        </Text>
        <Text variant="caption" tone="secondary" align="center" style={{ marginTop: 2 }}>
          Live map renders on iOS & Android
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// iOS implementation
// ─────────────────────────────────────────────────────────────────────────────

function AppleMapsView({
  valid,
  startPin,
  endPin,
  routeCoords,
  camera,
  fitKey,
  routeColor,
  pinColor,
  foodColor,
  startColor,
  endColor,
  scheme,
  style,
}: {
  valid: TripMapStop[];
  startPin?: TripMapPin;
  endPin?: TripMapPin;
  routeCoords: { latitude: number; longitude: number }[];
  camera: { coordinates: { latitude: number; longitude: number }; zoom: number };
  fitKey?: string | number;
  routeColor: string;
  pinColor: string;
  foodColor: string;
  startColor: string;
  endColor: string;
  scheme: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<AppleMaps.MapView>(null);

  // Re-fit the camera whenever the day (fitKey) or camera target changes.
  useEffect(() => {
    ref.current?.setCameraPosition({ coordinates: camera.coordinates, zoom: camera.zoom });
  }, [camera.coordinates, camera.zoom, fitKey]);

  const stopAnnotations: AppleMaps.Annotation[] = valid.map((s, i) => ({
    id: s.id,
    coordinates: { latitude: s.location.lat, longitude: s.location.lng },
    title: s.name,
    text: String(i + 1),
    backgroundColor: s.isFood ? foodColor : pinColor,
    textColor: '#FFFFFF',
    tintColor: s.isFood ? foodColor : pinColor,
  }));

  // Distinct endpoint pins: accent for the start, graphite for the end.
  const endpointAnnotations: AppleMaps.Annotation[] = [];
  if (startPin) {
    endpointAnnotations.push({
      id: '__start__',
      coordinates: { latitude: startPin.lat, longitude: startPin.lng },
      title: startPin.label,
      text: '◉',
      backgroundColor: startColor,
      textColor: '#FFFFFF',
      tintColor: startColor,
    });
  }
  if (endPin) {
    endpointAnnotations.push({
      id: '__end__',
      coordinates: { latitude: endPin.lat, longitude: endPin.lng },
      title: endPin.label,
      text: '◆',
      backgroundColor: endColor,
      textColor: '#FFFFFF',
      tintColor: endColor,
    });
  }

  const annotations: AppleMaps.Annotation[] = [...endpointAnnotations, ...stopAnnotations];

  const polylines: AppleMaps.MapProps['polylines'] =
    routeCoords.length >= 2 ? [{ coordinates: routeCoords, color: routeColor, width: 5 }] : [];

  return (
    <AppleMaps.View
      ref={ref}
      style={[styles.map, style]}
      cameraPosition={{ coordinates: camera.coordinates, zoom: camera.zoom }}
      annotations={annotations}
      polylines={polylines}
      colorScheme={scheme === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
      uiSettings={{ compassEnabled: false, scaleBarEnabled: false, myLocationButtonEnabled: false, togglePitchEnabled: false }}
      properties={{ selectionEnabled: false, isMyLocationEnabled: false }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Android implementation
// ─────────────────────────────────────────────────────────────────────────────

function GoogleMapsView({
  valid,
  startPin,
  endPin,
  routeCoords,
  camera,
  routeColor,
  pinColor,
  foodColor,
  scheme,
  style,
}: {
  valid: TripMapStop[];
  startPin?: TripMapPin;
  endPin?: TripMapPin;
  routeCoords: { latitude: number; longitude: number }[];
  camera: { coordinates: { latitude: number; longitude: number }; zoom: number };
  routeColor: string;
  pinColor: string;
  foodColor: string;
  scheme: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  const stopMarkers: GoogleMaps.Marker[] = valid.map((s, i) => ({
    id: s.id,
    coordinates: { latitude: s.location.lat, longitude: s.location.lng },
    title: `${i + 1}. ${s.name}`,
    snippet: s.isFood ? 'Food stop' : undefined,
  }));

  // Distinct labelled endpoint markers for the day's start and end.
  const endpointMarkers: GoogleMaps.Marker[] = [];
  if (startPin) {
    endpointMarkers.push({ id: '__start__', coordinates: { latitude: startPin.lat, longitude: startPin.lng }, title: startPin.label, snippet: 'Start' });
  }
  if (endPin) {
    endpointMarkers.push({ id: '__end__', coordinates: { latitude: endPin.lat, longitude: endPin.lng }, title: endPin.label, snippet: 'End' });
  }

  const markers: GoogleMaps.Marker[] = [...endpointMarkers, ...stopMarkers];

  const polylines: GoogleMaps.MapProps['polylines'] =
    routeCoords.length >= 2 ? [{ coordinates: routeCoords, color: routeColor, width: 5 }] : [];

  // Silence "unused" on color props the Google marker API can't tint per-pin.
  void pinColor;
  void foodColor;

  return (
    <GoogleMaps.View
      style={[styles.map, style]}
      cameraPosition={{ coordinates: camera.coordinates, zoom: camera.zoom }}
      markers={markers}
      polylines={polylines}
      colorScheme={scheme === 'dark' ? GoogleMaps.MapColorScheme.DARK : GoogleMaps.MapColorScheme.LIGHT}
      uiSettings={{ compassEnabled: false, myLocationButtonEnabled: false, mapToolbarEnabled: false }}
      properties={{ isMyLocationEnabled: false }}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackInner: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
});
