/**
 * The plan — the payoff. A full-bleed map of the active day with a floating day
 * strip, then a sheet with the day summary and the time-by-time timeline. Open
 * the route in Google Maps or copy the link; edit places or start over.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { formatCostSummary, formatDateLabel, formatDistance, formatDuration, formatMinutes, type DayPlan, type LatLng, type Place, type RouteLeg } from '@/core';
import { getLocalDishes } from '@/data';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import {
  Button,
  DayTabStrip,
  EmptyState,
  GlassSurface,
  IconSymbol,
  PlaceDetailSheet,
  Screen,
  Tag,
  Text,
  TimelineStop,
  TripMap,
  WeatherPill,
  hapticImpact,
  hapticNotify,
  hapticSelection,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  type TripMapPin,
  type TripMapStop,
} from '@/components';

const MAP_RATIO = 0.46;

const finiteLatLng = (p: LatLng | undefined): p is LatLng =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

export default function PlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const itinerary = useTrip((s) => s.itinerary);
  const activeDay = useTrip((s) => s.activeDay);
  const center = useTrip((s) => s.center);
  const currency = useTrip((s) => s.currency);
  const title = useTrip((s) => s.title);
  const cityId = useTrip((s) => s.cityId);
  const setActiveDay = useTrip((s) => s.setActiveDay);
  const reorderStops = useTrip((s) => s.reorderStops);
  const reset = useTrip((s) => s.reset);

  // Map height scales with the viewport but is clamped so it never crowds the
  // sheet on short devices (iPhone SE) or runs away on tall ones (Pro Max).
  const windowHeight = Dimensions.get('window').height;
  const mapHeight = Math.round(Math.min(Math.max(windowHeight * MAP_RATIO, 260), 460));
  // Clear the Dynamic Island for any chip floating over the map.
  const chipTop = Math.max(insets.top + 8, 74);

  // Measure the pinned action bar so the sheet/toast clear it exactly — no magic
  // numbers, so the last buttons are never hidden behind the bar at any size.
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const onActionBarLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setActionBarHeight(e.nativeEvent.layout.height);
  }, []);

  // Measure the floating day strip so it straddles the map/sheet seam by exactly
  // half its rendered height — it sits cleanly between the map and the sheet at
  // any size, never colliding with map labels above or the summary chips below.
  const [stripHeight, setStripHeight] = useState(0);
  const onStripLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setStripHeight(e.nativeEvent.layout.height);
  }, []);
  // Pull the strip up by half its height so its centre lands on the seam.
  const stripOverlap = stripHeight > 0 ? Math.round(stripHeight / 2) : theme.spacing.xxl;

  const days = itinerary?.days ?? [];
  const safeDay = Math.min(activeDay, Math.max(0, days.length - 1));
  const day: DayPlan | undefined = days[safeDay];

  const mapStops: TripMapStop[] = useMemo(
    () =>
      (day?.stops ?? []).map((s) => ({
        id: s.place.id,
        location: s.place.location,
        name: s.place.name,
        isFood: s.isFood || s.place.isFood,
      })),
    [day],
  );

  // Distinct, labelled map pins for where the day starts and ends.
  const startPin: TripMapPin | undefined = useMemo(() => {
    const loc = day?.startLocation ?? day?.window.startLocation;
    if (!finiteLatLng(loc)) return undefined;
    return { lat: loc.lat, lng: loc.lng, label: day?.window.startName ?? 'Start' };
  }, [day]);
  const endPin: TripMapPin | undefined = useMemo(() => {
    const loc = day?.endLocation ?? day?.window.endLocation;
    if (!finiteLatLng(loc)) return undefined;
    return { lat: loc.lat, lng: loc.lng, label: day?.window.endName ?? 'End' };
  }, [day]);

  // Must-try local dishes for the destination (curated per-city).
  const localDishes = useMemo<string[]>(() => (cityId ? getLocalDishes(cityId) : []), [cityId]);

  const onSelectDay = useCallback(
    (i: number) => {
      hapticSelection();
      setActiveDay(i);
    },
    [setActiveDay],
  );

  // Tapped place → photos + reviews sheet.
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const onOpenDetail = useCallback((place: Place) => {
    hapticSelection();
    setDetailPlace(place);
  }, []);

  // Toast
  const toast = useRef(new Animated.Value(0)).current;
  const [toastText, setToastText] = useState('');
  const showToast = useCallback(
    (text: string) => {
      setToastText(text);
      Animated.sequence([
        Animated.spring(toast, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200, mass: 1 }),
        Animated.delay(1400),
        Animated.timing(toast, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    },
    [toast],
  );

  // "What the AI did" toast — show once when the freshly-optimised plan opens.
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    if (itinerary && days.length > 0) {
      announced.current = true;
      const t = setTimeout(() => showToast('Sorted by travel time + weather + your pace'), 360);
      return () => clearTimeout(t);
    }
  }, [itinerary, days.length, showToast]);

  const onMoveStop = useCallback(
    (from: number, to: number) => {
      hapticSelection();
      reorderStops(safeDay, from, to);
    },
    [reorderStops, safeDay],
  );

  const onShare = useCallback(async () => {
    if (!day) return;
    hapticImpact(ImpactFeedbackStyle.Medium);
    const header = `${title} · Day ${safeDay + 1} — ${formatDateLabel(day.date)}`;
    const lines = day.stops.map(
      (s, i) => `${i + 1}. ${formatMinutes(s.arrivalMinutes)}  ${s.place.name}`,
    );
    const message = [header, '', ...lines, '', day.googleMapsUrl].join('\n');
    try {
      await Share.share({ message });
    } catch {
      /* user cancelled */
    }
  }, [day, safeDay, title]);

  const onOpenMaps = useCallback(async () => {
    if (!day?.googleMapsUrl) return;
    hapticImpact(ImpactFeedbackStyle.Medium);
    const ok = await Linking.canOpenURL(day.googleMapsUrl).catch(() => false);
    if (ok) {
      await Linking.openURL(day.googleMapsUrl).catch(() => {});
    } else {
      await Clipboard.setStringAsync(day.googleMapsUrl);
      showToast('Maps link copied');
    }
  }, [day, showToast]);

  const onCopyLink = useCallback(async () => {
    if (!day?.googleMapsUrl) return;
    await Clipboard.setStringAsync(day.googleMapsUrl);
    hapticNotify(NotificationFeedbackType.Success);
    showToast('Day link copied');
  }, [day, showToast]);

  const onEdit = useCallback(() => {
    hapticSelection();
    router.push('/select');
  }, [router]);

  const onNewTrip = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Medium);
    reset();
    router.replace('/');
  }, [reset, router]);

  // Empty / error guard
  if (!itinerary || days.length === 0) {
    return (
      <Screen title="Your plan" onBack={() => router.back()}>
        <EmptyState
          title="No plan yet"
          message="Head back and optimise your selected places to see your route."
          action={<Button title="Choose places" variant="secondary" onPress={() => router.replace('/select')} />}
        />
      </Screen>
    );
  }

  const tripUnscheduled = itinerary.unscheduled.length;
  const dayUnscheduled = day?.unscheduled.length ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Map */}
      <View style={[styles.mapWrap, { height: mapHeight }]}>
        <TripMap stops={mapStops} center={center} startPin={startPin} endPin={endPin} fitKey={safeDay} />

        {/* Subtle scrim so glass chrome reads over busy map detail. */}
        <LinearGradient
          pointerEvents="none"
          colors={[theme.colors.scrim, 'transparent']}
          style={[styles.scrimTop, { height: insets.top + 64 }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', theme.colors.scrim]}
          style={styles.scrimBottom}
        />

        {/* Back chip floating over the map */}
        <View style={[styles.backChip, { top: chipTop }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
            <GlassSurface variant="chip" interactive radius="pill" padding="none" sheen={false} floating>
              <View style={styles.backInner}>
                <IconSymbol name="chevron.left" size={16} color={theme.colors.onGlass} weight="semibold" fallbackGlyph="‹" />
                <Text variant="subhead" weight="600" tone="onGlass" numberOfLines={1}>
                  {title.length > 22 ? `${title.slice(0, 20).trimEnd()}…` : title}
                </Text>
              </View>
            </GlassSurface>
          </Pressable>
        </View>
      </View>

      {/* Day strip — inline (not absolute), dipping below the map's bottom edge
          by a measured, token-based overlap so it sits cleanly on the seam and
          never collides with map labels above or the sheet content below. */}
      <View style={[styles.stripWrap, { marginTop: -stripOverlap }]} onLayout={onStripLayout}>
        <DayTabStrip days={days} activeDay={safeDay} onSelect={onSelectDay} />
      </View>

      {/* Sheet — its rounded top tucks just under the strip. The top padding is
          derived from the measured strip height so the first chips clear it at
          any screen size (no fixed offsets). */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            // Tuck the rounded corner a hair under the strip's lower edge so the
            // seam reads as one surface — a small token, not a magic offset.
            marginTop: -theme.spacing.xs,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            // The sheet's rounded corner tucks `xs` under the strip; clear that
            // tuck plus a token of breathing room so the first chips never sit
            // under the strip at any screen size.
            paddingTop: theme.spacing.xs + theme.spacing.xl,
            paddingBottom: actionBarHeight + theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {day ? (
            <>
              {/* Cost hero, then a single horizontal-scroll chip row (no collisions). */}
              <View style={styles.summaryWrap}>
                <Text variant="caption" tone="tertiary" weight="700" style={styles.summaryLabel}>
                  DAY COST
                </Text>
                <Text variant="title" tone="accent">
                  {formatCostSummary(day.totalCost)}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.summaryChips}
                  style={{ marginTop: theme.spacing.md }}
                >
                  <Tag label={formatDistance(day.totalDistanceMeters)} tone="neutral" icon="arrow.triangle.turn.up.right.diamond.fill" iconFallback="↝" />
                  <Tag label={formatDuration(day.totalTravelMinutes)} tone="neutral" icon="figure.walk" iconFallback="🚶" />
                  {day.weather ? <WeatherPill weather={day.weather} /> : null}
                </ScrollView>
              </View>

              {/* Soft day-level advisory tips (e.g. "☔ Take an umbrella today").
                  Stacked above the timeline with margin; hidden when empty. */}
              {day.tips && day.tips.length > 0 ? (
                <View style={[styles.dayTips, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
                  <IconSymbol name="lightbulb.fill" size={14} color={theme.colors.accent} fallbackGlyph="💡" style={styles.dayTipIcon} />
                  <View style={styles.dayTipsText}>
                    {day.tips.map((tip, i) => (
                      <Text
                        key={i}
                        variant="footnote"
                        tone="accent"
                        weight="600"
                        style={i > 0 ? { marginTop: 2 } : undefined}
                      >
                        {tip}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}

              {day.warnings && day.warnings.length > 0 ? (
                <View style={[styles.dayWarn, { backgroundColor: `${theme.colors.warning}1A`, borderRadius: theme.radius.md }]}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={theme.colors.warning} fallbackGlyph="⚠" />
                  <Text variant="footnote" style={{ color: theme.colors.warning, flex: 1 }}>
                    {day.warnings[0]}
                  </Text>
                </View>
              ) : null}

              {/* Timeline */}
              <View style={{ marginTop: theme.spacing.xl }}>
                {day.stops.length > 1 ? (
                  <View style={styles.reorderHint}>
                    <IconSymbol name="arrow.up.arrow.down" size={12} color={theme.colors.textTertiary} fallbackGlyph="↕" />
                    <Text variant="caption" tone="tertiary">
                      You can reorder — the day re-times instantly.
                    </Text>
                  </View>
                ) : null}
                {day.stops.length === 0 ? (
                  <Text variant="callout" tone="secondary" align="center" style={{ paddingVertical: theme.spacing.xxl }}>
                    Nothing scheduled for this day.
                  </Text>
                ) : (
                  <>
                    {startPin ? (
                      <TerminalRow kind="start" name={day.window.startName ?? 'Start'} theme={theme} />
                    ) : null}
                    {day.stops.map((stop, i) => (
                      <TimelineStop
                        key={`${stop.place.id}-${i}`}
                        stop={stop}
                        index={i}
                        currency={currency}
                        isLast={i === day.stops.length - 1 && !endPin}
                        onMoveUp={() => onMoveStop(i, i - 1)}
                        onMoveDown={() => onMoveStop(i, i + 1)}
                        canMoveUp={i > 0}
                        canMoveDown={i < day.stops.length - 1}
                        onPress={() => onOpenDetail(stop.place)}
                      />
                    ))}
                    {endPin ? (
                      <TerminalRow
                        kind="end"
                        name={day.window.endName ?? 'End'}
                        leg={day.endLeg}
                        theme={theme}
                      />
                    ) : null}
                  </>
                )}
              </View>

              {dayUnscheduled > 0 ? (
                <Text variant="footnote" tone="tertiary" align="center" style={{ marginTop: theme.spacing.xs }}>
                  {dayUnscheduled} {dayUnscheduled === 1 ? "place didn't" : "places didn't"} fit this day
                </Text>
              ) : null}

              {/* Must-try local dishes for the destination. */}
              {localDishes.length > 0 ? (
                <GlassSurface variant="panel" radius="lg" padding="md" floating style={{ marginTop: theme.spacing.xl }}>
                  <View style={styles.dishesHead}>
                    <IconSymbol name="fork.knife" size={15} color={theme.colors.pinFood} fallbackGlyph="🍽" />
                    <Text variant="subhead" weight="700" tone="onGlass" style={{ flex: 1 }}>
                      Local dishes to try in {title}
                    </Text>
                  </View>
                  <View style={styles.dishesWrap}>
                    {localDishes.map((dish) => (
                      <Tag key={dish} label={dish} tone="food" />
                    ))}
                  </View>
                </GlassSurface>
              ) : null}
            </>
          ) : null}

          {tripUnscheduled > 0 ? (
            <View style={[styles.tripUnsched, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
              <Text variant="footnote" tone="secondary" align="center">
                {tripUnscheduled} {tripUnscheduled === 1 ? 'place' : 'places'} didn’t fit your time window.
              </Text>
            </View>
          ) : null}

          {/* Secondary actions */}
          <View style={styles.bottomActions}>
            <Button title="Edit places" variant="ghost" icon="arrow.triangle.2.circlepath" iconFallback="↺" onPress={onEdit} />
            <Button title="New trip" variant="ghost" onPress={onNewTrip} />
          </View>
        </ScrollView>
      </View>

      {/* Pinned edge-to-edge action bar — top corners rounded via overflow wrap. */}
      <View
        style={[styles.actionBarWrap, { borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl }]}
        onLayout={onActionBarLayout}
      >
        <GlassSurface variant="bar" radius="xl" padding="none" sheen={false} floating style={styles.actionBarFill}>
          <View
            style={[
              styles.actionBar,
              { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
            ]}
          >
            <Button
              title="Open in Maps"
              icon="map.fill"
              iconFallback="🗺"
              onPress={onOpenMaps}
              style={{ flex: 1 }}
            />
            <SquareGlassButton label="Share day" icon="square.and.arrow.up" glyph="􀈂" onPress={onShare} theme={theme} />
            <SquareGlassButton label="Copy day link" icon="doc.on.doc" glyph="⧉" onPress={onCopyLink} theme={theme} />
          </View>
        </GlassSurface>
      </View>

      {/* Toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            bottom: actionBarHeight + theme.spacing.md,
            opacity: toast,
            transform: [{ translateY: toast.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <GlassSurface variant="chip" radius="pill" padding="none" sheen={false} floating>
          <View style={styles.toastInner}>
            <IconSymbol name="checkmark.circle.fill" size={16} color={theme.colors.success} fallbackGlyph="✓" />
            <Text variant="footnote" weight="600" tone="onGlass">
              {toastText}
            </Text>
          </View>
        </GlassSurface>
      </Animated.View>

      {/* Photos + reviews for a tapped stop */}
      <PlaceDetailSheet place={detailPlace} currency={currency} onClose={() => setDetailPlace(null)} />
    </View>
  );
}

/** Origin / destination row on the timeline — where the day starts and ends. */
function TerminalRow({
  kind,
  name,
  leg,
  theme,
}: {
  kind: 'start' | 'end';
  name: string;
  leg?: RouteLeg;
  theme: ReturnType<typeof useTheme>;
}) {
  const isStart = kind === 'start';
  const color = isStart ? theme.colors.accent : theme.colors.textSecondary;
  return (
    <View style={styles.terminalRow}>
      <View style={styles.terminalRail}>
        {!isStart ? <View style={[styles.terminalConnectorTop, { backgroundColor: theme.colors.border }]} /> : null}
        <View style={[styles.terminalNode, { backgroundColor: color, borderColor: theme.colors.surface }]}>
          <IconSymbol
            name={isStart ? 'location.fill' : 'flag.checkered'}
            size={12}
            color="#FFFFFF"
            fallbackGlyph={isStart ? '◉' : '⚑'}
          />
        </View>
        {isStart ? <View style={[styles.terminalConnector, { backgroundColor: theme.colors.border }]} /> : null}
      </View>
      <View style={styles.terminalContent}>
        {!isStart && leg ? (
          <View style={[styles.terminalLegChip, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
            <Text variant="caption" tone="secondary">
              ↩ {formatDuration(leg.durationMinutes)} · {formatDistance(leg.distanceMeters)} back
            </Text>
          </View>
        ) : null}
        <Text variant="caption" tone="tertiary" weight="700" style={styles.terminalLabel}>
          {isStart ? 'START' : 'END'}
        </Text>
        <Text variant="subhead" weight="600" tone="onGlass" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

function SquareGlassButton({
  label,
  icon,
  glyph,
  onPress,
  theme,
}: {
  label: string;
  icon: Parameters<typeof IconSymbol>[0]['name'];
  glyph: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <GlassSurface variant="chip" interactive radius="lg" padding="none" sheen={false}>
        <View style={styles.squareBtn}>
          <IconSymbol name={icon} size={18} color={theme.colors.onGlass} weight="semibold" fallbackGlyph={glyph} />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mapWrap: {
    width: '100%',
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  backChip: {
    position: 'absolute',
    left: 12,
    maxWidth: '70%',
  },
  backInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  stripWrap: {
    paddingHorizontal: 12,
    zIndex: 5,
  },
  sheet: {
    flex: 1,
  },
  summaryWrap: {
    alignItems: 'flex-start',
  },
  summaryLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  summaryChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  reorderHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dayWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginTop: 14,
  },
  dayTips: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginTop: 16,
  },
  dayTipIcon: {
    marginTop: 1,
  },
  dayTipsText: {
    flex: 1,
    flexShrink: 1,
  },
  dishesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dishesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tripUnsched: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 16,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  actionBarFill: {
    borderRadius: 0,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  squareBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  terminalRail: {
    width: 28,
    alignItems: 'center',
  },
  terminalNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginTop: 2,
  },
  terminalConnector: {
    width: 2,
    height: 18,
    marginTop: 4,
    borderRadius: 1,
  },
  terminalConnectorTop: {
    width: 2,
    height: 18,
    marginBottom: 4,
    borderRadius: 1,
  },
  terminalContent: {
    flex: 1,
    paddingBottom: 12,
    justifyContent: 'center',
  },
  terminalLegChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  terminalLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
