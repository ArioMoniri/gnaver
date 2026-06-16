/**
 * The plan — the payoff. A full-bleed map of the active day with a floating day
 * strip, then a sheet with the day summary and the time-by-time timeline. Open
 * the route in Google Maps or copy the link; edit places or start over.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { formatCostSummary, formatDistance, formatDuration, type DayPlan } from '@/core';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import {
  Button,
  DayTabStrip,
  EmptyState,
  GlassCard,
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
        {/* Back chip floating over the map */}
        <View style={[styles.backChip, { top: insets.top + 8 }]}>
          <GlassCard padding="none" radius="pill" floating style={styles.backChipInner}>
            <Button
              title={title.length > 22 ? `${title.slice(0, 20).trimEnd()}…` : title}
              variant="ghost"
              size="sm"
              icon="chevron.left"
              iconFallback="‹"
              onPress={() => router.back()}
            />
          </GlassCard>
        </View>
      </View>

      {/* Floating day strip overlapping the map's bottom edge */}
      <View style={[styles.stripWrap, { top: mapHeight - 32 }]}>
        <DayTabStrip days={days} activeDay={safeDay} onSelect={onSelectDay} />
      </View>

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: theme.colors.background, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, marginTop: -24 }]}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xxl,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {day ? (
            <>
              {/* Summary chips */}
              <View style={styles.summaryRow}>
                <Tag label={formatCostSummary(day.totalCost)} tone="accent" icon="eurosign.circle.fill" iconFallback="€" />
                <Tag label={formatDistance(day.totalDistanceMeters)} tone="neutral" icon="arrow.triangle.turn.up.right.diamond.fill" iconFallback="↝" />
                <Tag label={formatDuration(day.totalTravelMinutes)} tone="neutral" icon="figure.walk" iconFallback="🚶" />
                {day.weather ? <WeatherPill weather={day.weather} /> : null}
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

              {/* Day actions */}
              <View style={styles.dayActions}>
                <Button
                  title="Open in Google Maps"
                  variant="secondary"
                  icon="map.fill"
                  iconFallback="🗺"
                  onPress={onOpenMaps}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Copy link"
                  variant="ghost"
                  icon="doc.on.doc"
                  iconFallback="⧉"
                  onPress={onCopyLink}
                />
              </View>
            </>
          ) : null}

          {tripUnscheduled > 0 ? (
            <View style={[styles.tripUnsched, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
              <Text variant="footnote" tone="secondary" align="center">
                {tripUnscheduled} {tripUnscheduled === 1 ? 'place' : 'places'} didn’t fit your time window.
              </Text>
            </View>
          ) : null}

          {/* Bottom actions */}
          <View style={styles.bottomActions}>
            <Button title="Edit places" variant="ghost" icon="arrow.triangle.2.circlepath" iconFallback="↺" onPress={onEdit} />
            <Button title="New trip" variant="secondary" onPress={onNewTrip} />
          </View>
        </ScrollView>
      </View>

      {/* Toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            bottom: insets.bottom + 28,
            opacity: toast,
            transform: [{ translateY: toast.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <GlassCard padding="sm" radius="pill" floating style={styles.toastInner}>
          <IconSymbol name="checkmark.circle.fill" size={16} color={theme.colors.success} fallbackGlyph="✓" />
          <Text variant="footnote" weight="600">
            {toastText}
          </Text>
        </GlassCard>
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
  backChip: {
    position: 'absolute',
    left: 12,
  },
  backChipInner: {
    overflow: 'hidden',
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginTop: 12,
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
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
    marginTop: 24,
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
  },
});
