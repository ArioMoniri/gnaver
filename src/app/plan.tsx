/**
 * The plan — the payoff. A full-bleed map of the active day with a floating day
 * strip, then a sheet with the day summary and the time-by-time timeline. Open
 * the route in Google Maps or copy the link; edit places or start over.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { formatCostSummary, formatDistance, formatDuration, type DayPlan } from '@/core';
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
  const reset = useTrip((s) => s.reset);

  const mapHeight = Math.round(Dimensions.get('window').height * MAP_RATIO);

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
        <View style={[styles.backChip, { top: insets.top + 8 }]}>
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

      {/* Floating day strip overlapping the map's bottom edge */}
      <View style={[styles.stripWrap, { top: mapHeight - 34 }]}>
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
            marginTop: -26,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xxl,
            paddingBottom: insets.bottom + 108,
          }}
          showsVerticalScrollIndicator={false}
        >
          {day ? (
            <>
              {/* Cost hero + supporting chips */}
              <View style={styles.summaryWrap}>
                <View>
                  <Text variant="caption" tone="tertiary" weight="700" style={styles.summaryLabel}>
                    DAY COST
                  </Text>
                  <Text variant="title" tone="accent">
                    {formatCostSummary(day.totalCost)}
                  </Text>
                </View>
                <View style={styles.summaryChips}>
                  <Tag label={formatDistance(day.totalDistanceMeters)} tone="neutral" icon="arrow.triangle.turn.up.right.diamond.fill" iconFallback="↝" />
                  <Tag label={formatDuration(day.totalTravelMinutes)} tone="neutral" icon="figure.walk" iconFallback="🚶" />
                  {day.weather ? <WeatherPill weather={day.weather} /> : null}
                </View>
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

      {/* Sticky glass action bar */}
      <View style={[styles.actionBarWrap, { paddingBottom: insets.bottom + theme.spacing.sm, paddingHorizontal: theme.spacing.lg }]}>
        <GlassSurface variant="bar" radius="xxl" padding="sm" floating style={styles.actionBar}>
          <Button
            title="Open in Google Maps"
            icon="map.fill"
            iconFallback="🗺"
            onPress={onOpenMaps}
            style={{ flex: 1 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Copy day link" onPress={onCopyLink}>
            <GlassSurface variant="chip" interactive radius="pill" padding="none" sheen={false}>
              <View style={styles.copyBtn}>
                <IconSymbol name="doc.on.doc" size={18} color={theme.colors.onGlass} weight="semibold" fallbackGlyph="⧉" />
              </View>
            </GlassSurface>
          </Pressable>
        </GlassSurface>
      </View>

      {/* Toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            bottom: insets.bottom + 88,
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
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 5,
  },
  sheet: {
    flex: 1,
  },
  summaryWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  summaryChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
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
    paddingTop: 8,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyBtn: {
    width: 46,
    height: 46,
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
