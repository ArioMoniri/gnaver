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

import { formatCostSummary, formatDateLabel, formatDistance, formatDuration, formatMinutes, type DayPlan } from '@/core';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import {
  Button,
  DayTabStrip,
  EmptyState,
  GlassSurface,
  IconSymbol,
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
  type TripMapStop,
} from '@/components';

const MAP_RATIO = 0.46;

export default function PlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const itinerary = useTrip((s) => s.itinerary);
  const activeDay = useTrip((s) => s.activeDay);
  const center = useTrip((s) => s.center);
  const currency = useTrip((s) => s.currency);
  const title = useTrip((s) => s.title);
  const setActiveDay = useTrip((s) => s.setActiveDay);
  const reorderStops = useTrip((s) => s.reorderStops);
  const reset = useTrip((s) => s.reset);

  const mapHeight = Math.round(Dimensions.get('window').height * MAP_RATIO);
  // Clear the Dynamic Island for any chip floating over the map.
  const chipTop = Math.max(insets.top + 8, 74);

  // Measure the pinned action bar so the sheet/toast clear it exactly.
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const onActionBarLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setActionBarHeight(e.nativeEvent.layout.height);
  }, []);

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

  const onSelectDay = useCallback(
    (i: number) => {
      hapticSelection();
      setActiveDay(i);
    },
    [setActiveDay],
  );

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
        <TripMap stops={mapStops} center={center} fitKey={safeDay} />

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

      {/* Day strip — inline (not absolute), overlapping the map's bottom edge as
          a glass bar so it never collides with the sheet content below it. */}
      <View style={styles.stripWrap}>
        <DayTabStrip days={days} activeDay={safeDay} onSelect={onSelectDay} />
      </View>

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            marginTop: -8,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xl,
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
                  day.stops.map((stop, i) => (
                    <TimelineStop
                      key={`${stop.place.id}-${i}`}
                      stop={stop}
                      index={i}
                      currency={currency}
                      isLast={i === day.stops.length - 1}
                      onMoveUp={() => onMoveStop(i, i - 1)}
                      onMoveDown={() => onMoveStop(i, i + 1)}
                      canMoveUp={i > 0}
                      canMoveDown={i < day.stops.length - 1}
                    />
                  ))
                )}
              </View>

              {dayUnscheduled > 0 ? (
                <Text variant="footnote" tone="tertiary" align="center" style={{ marginTop: theme.spacing.xs }}>
                  {dayUnscheduled} {dayUnscheduled === 1 ? "place didn't" : "places didn't"} fit this day
                </Text>
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
    marginTop: -34,
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
