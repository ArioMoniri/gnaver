/**
 * New Trip — the front door. Choose a city or paste a Google Maps list, then
 * tune the trip setup (interests, transport, pace, days, hours, food). Seeds the
 * trip store from saved settings on mount and pushes to /select when ready.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { formatMinutes, type FoodBudget, type Interest, type Pace, type TransportMode } from '@/core';
import { listCities } from '@/data';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import { useSettings } from '@/store/settingsStore';
import {
  ALL_INTERESTS,
  Button,
  Chip,
  GlassCard,
  GlassSurface,
  IconSymbol,
  Segmented,
  Stepper,
  Text,
  hapticImpact,
  hapticSelection,
  ImpactFeedbackStyle,
  interestMeta,
} from '@/components';

type Mode = 'city' | 'link';

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: 'walk', label: 'Walk' },
  { value: 'transit', label: 'Transit' },
  { value: 'drive', label: 'Drive' },
  { value: 'mixed', label: 'Mixed' },
];

const PACE_OPTIONS: { value: Pace; label: string }[] = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'packed', label: 'Packed' },
];

const BUDGET_OPTIONS: { value: FoodBudget; label: string }[] = [
  { value: 'cheap', label: 'Cheap' },
  { value: 'mid', label: 'Mid' },
  { value: 'fine', label: 'Fine' },
];

const HOUR_STEP = 30;

export default function NewTripScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cities = useMemo(() => listCities(), []);

  const settings = useSettings();
  const trip = useTrip();

  const [mode, setMode] = useState<Mode>('city');
  const [linkUrl, setLinkUrl] = useState('');

  // Seed trip store from saved settings once they've hydrated.
  useEffect(() => {
    if (!settings.hasHydrated) return;
    trip.setPreferences({
      interests: settings.interests,
      transport: settings.transport,
      pace: settings.pace,
      includeFood: settings.includeFood,
      foodBudget: settings.foodBudget,
      cuisinePrefs: settings.cuisinePrefs,
      dietary: settings.dietary,
      weather: {
        avoidRain: settings.avoidRain,
        avoidOutdoorAboveC: settings.avoidOutdoorAboveC,
        avoidOutdoorBelowC: settings.avoidOutdoorBelowC,
      },
    });
    trip.setDayCount(settings.defaultDays);
    trip.setHours(settings.defaultStartMinutes, settings.defaultEndMinutes);
    // Seed once on hydrate; subsequent edits flow through explicit handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.hasHydrated]);

  const prefs = trip.preferences;
  const cityChosen = trip.source === 'city' && !!trip.cityId;
  const linkLoaded = trip.source === 'link' && trip.candidates.length > 0;
  const loadingLink = trip.status === 'loadingCandidates';

  const canContinue = mode === 'city' ? cityChosen : linkLoaded;

  const toggleInterest = useCallback(
    (i: Interest) => {
      const has = prefs.interests.includes(i);
      const next = has ? prefs.interests.filter((x) => x !== i) : [...prefs.interests, i];
      trip.setPreferences({ interests: next });
    },
    [prefs.interests, trip],
  );

  const onPaste = useCallback(async () => {
    hapticSelection();
    const text = await Clipboard.getStringAsync().catch(() => '');
    if (text) {
      setLinkUrl(text.trim());
      void trip.startFromLink(text.trim());
    }
  }, [trip]);

  const onUseLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    void trip.startFromLink(linkUrl.trim());
  }, [linkUrl, trip]);

  const onSample = useCallback(() => {
    hapticSelection();
    setLinkUrl('');
    trip.loadSampleList();
  }, [trip]);

  const onContinue = useCallback(() => {
    if (!canContinue) return;
    hapticImpact(ImpactFeedbackStyle.Medium);
    router.push('/select');
  }, [canContinue, router]);

  return (
    <View style={styles.root}>
      {/* Hero background wash */}
      <LinearGradient
        colors={theme.gradients.hero as unknown as readonly [string, string]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={theme.gradients.accentWash as unknown as readonly [string, string]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { height: 320 }]}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: insets.bottom + 132,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <LinearGradient
                colors={theme.gradients.brand as unknown as readonly [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glyph, theme.elevation.card]}
              >
                <View pointerEvents="none" style={[styles.glyphSpec, { backgroundColor: theme.colors.glassStroke }]} />
                <IconSymbol name="map.fill" size={22} color={theme.colors.onAccent} fallbackGlyph="🗺" />
              </LinearGradient>
              <Text variant="hero">Gnaver</Text>
            </View>
            <Text variant="callout" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
              Turn a wishlist into the perfect day-by-day route.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => {
              hapticSelection();
              router.push('/settings');
            }}
          >
            <GlassSurface variant="chip" interactive radius="pill" padding="none" sheen={false} style={styles.gearWrap}>
              <View style={styles.gear}>
                <IconSymbol name="gearshape.fill" size={20} color={theme.colors.onGlass} />
              </View>
            </GlassSurface>
          </Pressable>
        </View>

        {/* Source mode */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <Segmented<Mode>
            options={[
              { value: 'city', label: 'City' },
              { value: 'link', label: 'Google list' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>

        {mode === 'city' ? (
          <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
            {cities.map((city) => {
              const active = trip.cityId === city.id && trip.source === 'city';
              return (
                <CityCard
                  key={city.id}
                  emoji={city.emoji}
                  name={city.name}
                  country={city.country}
                  blurb={city.blurb}
                  active={active}
                  onPress={() => {
                    hapticSelection();
                    void trip.startFromCity(city.id);
                  }}
                />
              );
            })}
          </View>
        ) : (
          <View style={{ marginTop: theme.spacing.lg }}>
            <GlassCard padding="lg" radius="xl" floating>
              <Text variant="subhead" weight="600">
                Paste a Google Maps list link
              </Text>
              <Text variant="footnote" tone="onGlassSecondary" style={{ marginTop: 2 }}>
                A shared saved-places list or a maps.app.goo.gl link.
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md },
                ]}
              >
                <IconSymbol name="link" size={16} color={theme.colors.textTertiary} />
                <TextInput
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  onSubmitEditing={onUseLink}
                  placeholder="https://maps.app.goo.gl/…"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  style={[styles.input, { color: theme.colors.text }]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="Paste" hitSlop={8} onPress={onPaste}>
                  <Text variant="footnote" weight="600" tone="accent">
                    Paste
                  </Text>
                </Pressable>
              </View>

              <View style={styles.linkActions}>
                <Button
                  title="Load link"
                  variant="secondary"
                  size="sm"
                  onPress={onUseLink}
                  disabled={!linkUrl.trim() || loadingLink}
                  loading={loadingLink}
                />
                <Button
                  title="Use a sample list"
                  variant="ghost"
                  size="sm"
                  icon="sparkles"
                  iconFallback="✨"
                  onPress={onSample}
                />
              </View>

              {trip.status === 'error' && trip.error ? (
                <Text variant="footnote" tone="danger" style={{ marginTop: theme.spacing.sm }}>
                  {trip.error}
                </Text>
              ) : null}

              {linkLoaded ? (
                <View style={[styles.loadedRow, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
                  <IconSymbol name="checkmark.circle.fill" size={16} color={theme.colors.accent} />
                  <Text variant="footnote" weight="600" tone="accent" numberOfLines={1} style={{ flex: 1 }}>
                    {trip.title} · {trip.candidates.length} places
                  </Text>
                </View>
              ) : null}
            </GlassCard>
          </View>
        )}

        {/* Trip setup */}
        <View style={{ marginTop: theme.spacing.xxl }}>
          <Text variant="title2" style={{ marginBottom: theme.spacing.md }}>
            Trip setup
          </Text>
          <GlassCard padding="lg" radius="xl" floating>
            <SectionLabel theme={theme}>Interests</SectionLabel>
            <View style={styles.chipWrap}>
              {ALL_INTERESTS.map((i) => {
                const m = interestMeta(i);
                return (
                  <Chip
                    key={i}
                    label={m.label}
                    emoji={m.emoji}
                    size="sm"
                    selected={prefs.interests.includes(i)}
                    onPress={() => toggleInterest(i)}
                  />
                );
              })}
            </View>

            <View style={styles.field}>
              <SectionLabel theme={theme}>Getting around</SectionLabel>
              <Segmented<TransportMode>
                options={TRANSPORT_OPTIONS}
                value={prefs.transport}
                onChange={(transport) => trip.setPreferences({ transport })}
              />
            </View>

            <View style={styles.field}>
              <SectionLabel theme={theme}>Pace</SectionLabel>
              <Segmented<Pace>
                options={PACE_OPTIONS}
                value={prefs.pace}
                onChange={(pace) => trip.setPreferences({ pace })}
              />
            </View>

            <View style={styles.field}>
              <Stepper label="Days" value={trip.dayCount} min={1} max={14} onChange={(n) => trip.setDayCount(n)} />
            </View>

            <View style={styles.field}>
              <Stepper
                label="Start the day"
                value={trip.startMinutes}
                min={5 * 60}
                max={trip.endMinutes - HOUR_STEP}
                step={HOUR_STEP}
                format={formatMinutes}
                onChange={(m) => trip.setHours(m, trip.endMinutes)}
              />
            </View>
            <View style={styles.field}>
              <Stepper
                label="End the day"
                value={trip.endMinutes}
                min={trip.startMinutes + HOUR_STEP}
                max={24 * 60}
                step={HOUR_STEP}
                format={formatMinutes}
                onChange={(m) => trip.setHours(trip.startMinutes, m)}
              />
            </View>

            <View style={[styles.foodToggleRow, styles.field]}>
              <View style={{ flex: 1 }}>
                <Text variant="subhead" weight="600">
                  Include food stops
                </Text>
                <Text variant="caption" tone="onGlassSecondary">
                  Weave in cafés and restaurants around mealtimes.
                </Text>
              </View>
              <Switch
                value={prefs.includeFood}
                onValueChange={(v) => {
                  hapticSelection();
                  trip.setPreferences({ includeFood: v });
                }}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                thumbColor={theme.colors.surfaceElevated}
                ios_backgroundColor={theme.colors.border}
              />
            </View>

            {prefs.includeFood ? (
              <View style={styles.field}>
                <SectionLabel theme={theme}>Food budget</SectionLabel>
                <Segmented<FoodBudget>
                  options={BUDGET_OPTIONS}
                  value={prefs.foodBudget ?? 'mid'}
                  onChange={(foodBudget) => trip.setPreferences({ foodBudget })}
                />
              </View>
            ) : null}
          </GlassCard>
        </View>
      </ScrollView>

      {/* Sticky glass CTA bar */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: theme.spacing.xl }]}>
        <GlassSurface variant="bar" radius="xxl" padding="md" floating style={styles.ctaBar}>
          <Button
            title="Find places"
            icon="arrow.right"
            iconFallback="→"
            trailingIcon
            fullWidth
            size="lg"
            disabled={!canContinue}
            onPress={onContinue}
          />
        </GlassSurface>
      </View>
    </View>
  );
}

function CityCard({
  emoji,
  name,
  country,
  blurb,
  active,
  onPress,
}: {
  emoji: string;
  name: string;
  country: string;
  blurb: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      damping: theme.motion.springBouncy.damping,
      stiffness: theme.motion.springBouncy.stiffness,
      mass: theme.motion.springBouncy.mass,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
      >
        <GlassCard
          padding="md"
          radius="lg"
          floating={active}
          style={active ? { borderColor: theme.colors.accent, borderWidth: 1.5 } : undefined}
        >
          <View style={styles.cityRow}>
            <View style={[styles.cityEmojiWrap, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
              <Text style={styles.cityEmoji}>{emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cityTitleRow}>
                <Text variant="headline">{name}</Text>
                <Text variant="footnote" tone="onGlassSecondary">
                  {country}
                </Text>
              </View>
              <Text variant="footnote" tone="onGlassSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
                {blurb}
              </Text>
            </View>
            <View
              style={[
                styles.radio,
                active
                  ? { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }
                  : { borderColor: theme.colors.glassBorder },
              ]}
            >
              {active ? <IconSymbol name="checkmark" size={13} color={theme.colors.onAccent} weight="bold" /> : null}
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

function SectionLabel({ children, theme }: { children: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <Text
      variant="caption"
      tone="onGlassSecondary"
      weight="700"
      style={{ marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glyph: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyphSpec: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.7,
  },
  gearWrap: {
    borderRadius: 22,
  },
  gear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cityEmojiWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityEmoji: {
    fontSize: 28,
  },
  cityTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  linkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  loadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginTop: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  field: {
    marginTop: 18,
  },
  foodToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
  },
  ctaBar: {
    overflow: 'visible',
  },
});
