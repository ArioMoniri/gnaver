/**
 * New Trip — the front door. Choose a city or paste a Google Maps list, then
 * tune the trip setup (interests, transport, pace, days, hours, food). Seeds the
 * trip store from saved settings on mount and pushes to /select when ready.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import {
  formatMinutes,
  formatDateLabel,
  addDays,
  type FoodBudget,
  type Interest,
  type MealKind,
  type Pace,
  type TransportMode,
  type CitySuggestion,
} from '@/core';
import { listCities } from '@/data';
import { flagFor } from '@/components/cityFlags';
import { placesProvider } from '@/services';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import { useSettings } from '@/store/settingsStore';
import {
  ALL_INTERESTS,
  BrandGlyph,
  Button,
  Chip,
  DayOptionsSheet,
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

const ONBOARDED_KEY = 'gnaver.onboarded';

const CUISINE_OPTIONS = ['Local', 'Italian', 'Japanese', 'Vegetarian', 'Seafood', 'Street food'];

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

const MEAL_OPTIONS: { value: MealKind; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🥐' },
  { value: 'lunch', label: 'Lunch', emoji: '🍽' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙' },
];

const HOUR_STEP = 30;

/** Convert a JS Date from DateTimePicker to a local yyyy-mm-dd string without UTC shifting. */
function jsDateToIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewTripScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cities = useMemo(() => listCities(), []);

  const settings = useSettings();
  const trip = useTrip();

  const [mode, setMode] = useState<Mode>('city');
  const [linkUrl, setLinkUrl] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cuisineDraft, setCuisineDraft] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDayOptions, setShowDayOptions] = useState(false);

  // City autocomplete dropdown state
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // CTA bar height measured for ScrollView bottom padding
  const [ctaHeight, setCtaHeight] = useState(132);

  // First-run onboarding triptych (one-row, AsyncStorage flag).
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => {
        if (mounted && !v) setShowOnboarding(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const dismissOnboarding = useCallback(() => {
    hapticSelection();
    setShowOnboarding(false);
    void AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
  }, []);

  // Continuous spin for the inline "finding city" indicator.
  const spinValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 900, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinValue]);
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Seed trip store from saved settings once they've hydrated.
  useEffect(() => {
    if (!settings.hasHydrated) return;
    trip.setPreferences({
      interests: settings.interests,
      transport: settings.transport,
      pace: settings.pace,
      includeFood: settings.includeFood,
      meals: settings.meals,
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

  // Autocomplete: debounce 300 ms, min 2 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = cityQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    debounceRef.current = setTimeout(() => {
      placesProvider
        .autocompleteCities(q)
        .then((results) => {
          setSuggestions(results);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cityQuery]);

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

  const onPickSuggestion = useCallback(
    (suggestion: CitySuggestion) => {
      hapticSelection();
      setCityQuery(suggestion.label);
      setSuggestions([]);
      // A curated suggestion carries our city id — load it directly (works
      // offline). Live (Google) suggestions geocode via the label.
      const curated = suggestion.id && cities.some((c) => c.id === suggestion.id);
      if (curated && suggestion.id) void trip.startFromCity(suggestion.id);
      else void trip.startFromCityQuery(suggestion.label);
    },
    [trip, cities],
  );

  const onPickCity = useCallback(
    (id: string, name: string) => {
      hapticSelection();
      setCityQuery(name);
      setSuggestions([]);
      void trip.startFromCity(id);
    },
    [trip],
  );

  const onDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (date) {
        hapticSelection();
        trip.setStartDate(jsDateToIso(date));
      }
    },
    [trip],
  );

  const cuisinePrefs = useMemo(() => prefs.cuisinePrefs ?? [], [prefs.cuisinePrefs]);
  const toggleCuisine = useCallback(
    (cuisine: string) => {
      const has = cuisinePrefs.includes(cuisine);
      const next = has ? cuisinePrefs.filter((c) => c !== cuisine) : [...cuisinePrefs, cuisine];
      trip.setPreferences({ cuisinePrefs: next });
    },
    [cuisinePrefs, trip],
  );

  const addCuisine = useCallback(() => {
    const c = cuisineDraft.trim();
    if (!c) return;
    if (!cuisinePrefs.some((x) => x.toLowerCase() === c.toLowerCase())) {
      hapticSelection();
      trip.setPreferences({ cuisinePrefs: [...cuisinePrefs, c] });
    }
    setCuisineDraft('');
  }, [cuisineDraft, cuisinePrefs, trip]);

  const meals = useMemo(() => prefs.meals ?? [], [prefs.meals]);
  const toggleMeal = useCallback(
    (meal: MealKind) => {
      hapticSelection();
      const has = meals.includes(meal);
      const next = has ? meals.filter((m) => m !== meal) : [...meals, meal];
      trip.setPreferences({ meals: next });
    },
    [meals, trip],
  );

  const quickBites = (prefs.maxWalkMinutes ?? 0) > 0;
  const toggleQuickBites = useCallback(
    (v: boolean) => {
      hapticSelection();
      trip.setPreferences({ maxWalkMinutes: v ? 12 : undefined });
    },
    [trip],
  );

  const onCtaLayout = useCallback((e: LayoutChangeEvent) => {
    setCtaHeight(e.nativeEvent.layout.height);
  }, []);

  // Date range label: "Tue, Jun 16 → Thu, Jun 18"
  const dateRangeLabel = useMemo(() => {
    const start = formatDateLabel(trip.startDate);
    const end = formatDateLabel(addDays(trip.startDate, trip.dayCount - 1));
    return `${start} → ${end}`;
  }, [trip.startDate, trip.dayCount]);

  // JS Date object for the picker, constructed without UTC shifting
  const pickerDate = useMemo(() => {
    const [y, m, d] = trip.startDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [trip.startDate]);

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
          paddingBottom: insets.bottom + ctaHeight + theme.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <BrandGlyph size={48} />
              <Text variant="hero">Gnaver</Text>
            </View>
            <Text variant="callout" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
              Turn a wishlist into the perfect day-by-day route.
            </Text>
            <Text variant="footnote" tone="tertiary" style={{ marginTop: 4 }}>
              AI-optimized routes · Weather-aware{'\n'}Built from your Google Maps lists
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

        {/* First-run onboarding triptych */}
        {showOnboarding ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss intro"
            onPress={dismissOnboarding}
            style={{ marginTop: theme.spacing.xl }}
          >
            <GlassCard padding="md" radius="xl" floating>
              <View style={styles.onboardRow}>
                <OnboardCell emoji="🗺" text="Your saved places" />
                <View style={[styles.onboardDivider, { backgroundColor: theme.colors.glassBorder }]} />
                <OnboardCell emoji="🤖" text="AI optimizes the day" />
                <View style={[styles.onboardDivider, { backgroundColor: theme.colors.glassBorder }]} />
                <OnboardCell emoji="📍" text="Time-by-time route" />
              </View>
              <Text variant="caption" tone="onGlassSecondary" align="center" style={{ marginTop: theme.spacing.sm }}>
                Tap to dismiss
              </Text>
            </GlassCard>
          </Pressable>
        ) : null}

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
          <View style={{ marginTop: theme.spacing.lg }}>
            <GlassCard padding="lg" radius="xl" floating>
              <Text variant="subhead" weight="600">
                Search any city
              </Text>
              <Text variant="footnote" tone="onGlassSecondary" style={{ marginTop: 2 }}>
                Type a destination — anywhere in the world.
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md },
                ]}
              >
                <IconSymbol name="magnifyingglass" size={16} color={theme.colors.textTertiary} fallbackGlyph="⌕" />
                <TextInput
                  value={cityQuery}
                  onChangeText={(t) => {
                    setCityQuery(t);
                    // Clear chosen city if user edits
                  }}
                  placeholder="Search any city…"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    const q = cityQuery.trim();
                    if (q) {
                      hapticSelection();
                      void trip.startFromCityQuery(q);
                    }
                  }}
                  style={[styles.input, { color: theme.colors.text }]}
                />
                {loadingSuggestions ? (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <IconSymbol name="arrow.triangle.2.circlepath" size={15} color={theme.colors.accent} fallbackGlyph="↻" />
                  </Animated.View>
                ) : cityQuery.trim() ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear city search"
                    hitSlop={8}
                    onPress={() => {
                      setCityQuery('');
                      setSuggestions([]);
                    }}
                  >
                    <IconSymbol name="xmark.circle.fill" size={16} color={theme.colors.textTertiary} fallbackGlyph="✕" />
                  </Pressable>
                ) : null}
              </View>

              {/* Autocomplete dropdown */}
              {suggestions.length > 0 ? (
                <View
                  style={[
                    styles.dropdown,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md },
                  ]}
                >
                  {suggestions.map((s, idx) => (
                    <Pressable
                      key={s.id ?? s.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${s.label}`}
                      onPress={() => onPickSuggestion(s)}
                      style={[
                        styles.dropdownRow,
                        idx < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <IconSymbol name="mappin" size={13} color={theme.colors.accent} fallbackGlyph="📍" />
                      <Text variant="footnote" tone="onGlass" numberOfLines={1} style={{ flex: 1 }}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : cityQuery.trim().length >= 2 && !loadingSuggestions && suggestions.length === 0 && !cityChosen ? (
                // No type-ahead match (e.g. an unusual spelling, or the field was
                // autofilled to "City, Country"). Always give a way forward: tap
                // to search the raw text — startFromCityQuery resolves it directly.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${cityQuery.trim()}`}
                  onPress={() => {
                    hapticSelection();
                    void trip.startFromCityQuery(cityQuery.trim());
                  }}
                  style={[
                    styles.dropdown,
                    styles.dropdownRow,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md },
                  ]}
                >
                  <IconSymbol name="magnifyingglass" size={13} color={theme.colors.accent} fallbackGlyph="⌕" />
                  <Text variant="footnote" tone="onGlass" numberOfLines={1} style={{ flex: 1 }}>
                    Search “{cityQuery.trim()}”
                  </Text>
                </Pressable>
              ) : null}

              {/* Status row (loading / error / success) */}
              {loadingLink ? (
                <View style={[styles.loadedRow, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <IconSymbol name="arrow.triangle.2.circlepath" size={15} color={theme.colors.accent} fallbackGlyph="↻" />
                  </Animated.View>
                  <Text variant="footnote" weight="600" tone="accent" numberOfLines={1} style={{ flex: 1 }}>
                    Finding {cityQuery.trim() || 'your city'}…
                  </Text>
                </View>
              ) : trip.status === 'error' && trip.error ? (
                <Text variant="footnote" tone="danger" style={{ marginTop: theme.spacing.sm }}>
                  {trip.error}
                </Text>
              ) : cityChosen ? (
                <View style={[styles.loadedRow, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
                  <IconSymbol name="checkmark.circle.fill" size={16} color={theme.colors.accent} />
                  <Text variant="footnote" weight="600" tone="accent" numberOfLines={1} style={{ flex: 1 }}>
                    {trip.title} · {trip.candidates.length} places
                  </Text>
                </View>
              ) : null}

              <Text variant="caption" tone="onGlassSecondary" weight="700" style={styles.suggestLabel}>
                POPULAR CITIES
              </Text>
              <View style={styles.suggestWrap}>
                {cities.map((city) => {
                  const active = trip.cityId === city.id && trip.source === 'city';
                  return (
                    <Chip
                      key={city.id}
                      label={city.name}
                      image={flagFor(city.id)}
                      emoji={city.emoji}
                      size="sm"
                      selected={active}
                      onPress={() => onPickCity(city.id, city.name)}
                    />
                  );
                })}
              </View>
            </GlassCard>
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

            {/* Start date picker */}
            <View style={styles.field}>
              <SectionLabel theme={theme}>Start date</SectionLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick start date"
                onPress={() => {
                  hapticSelection();
                  setShowDatePicker(true);
                }}
                style={[
                  styles.datePressable,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <IconSymbol name="calendar" size={16} color={theme.colors.accent} fallbackGlyph="📅" />
                <Text variant="subhead" weight="600" tone="onGlass" style={{ flex: 1 }}>
                  {dateRangeLabel}
                </Text>
                <IconSymbol name="chevron.right" size={13} color={theme.colors.textTertiary} fallbackGlyph="›" />
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  mode="date"
                  value={pickerDate}
                  minimumDate={todayDate}
                  onChange={onDateChange}
                  display="spinner"
                />
              )}
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

            {/* Prominent Day Options card */}
            <View style={styles.field}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set daily start and end locations"
                onPress={() => {
                  hapticImpact(ImpactFeedbackStyle.Light);
                  setShowDayOptions(true);
                }}
              >
                <View
                  style={[
                    styles.dayOptionsCard,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accent,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <View style={styles.dayOptionsIcon}>
                    <IconSymbol name="bed.double.fill" size={18} color={theme.colors.accent} fallbackGlyph="🏨" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subhead" weight="700" tone="accent">
                      Set daily start &amp; end (hotel)
                    </Text>
                    <Text variant="caption" tone="onGlassSecondary" style={{ marginTop: 2 }}>
                      Choose where each day begins and ends — your hotel, Airbnb, or any address.
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={14} color={theme.colors.accent} fallbackGlyph="›" />
                </View>
              </Pressable>
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
              <>
                <View style={styles.field}>
                  <SectionLabel theme={theme}>Meals to include</SectionLabel>
                  <View style={styles.chipWrap}>
                    {MEAL_OPTIONS.map((m) => (
                      <Chip
                        key={m.value}
                        label={m.label}
                        emoji={m.emoji}
                        size="sm"
                        selected={meals.includes(m.value)}
                        onPress={() => toggleMeal(m.value)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.field}>
                  <SectionLabel theme={theme}>Food budget</SectionLabel>
                  <Segmented<FoodBudget>
                    options={BUDGET_OPTIONS}
                    value={prefs.foodBudget ?? 'mid'}
                    onChange={(foodBudget) => trip.setPreferences({ foodBudget })}
                  />
                </View>

                <View style={styles.field}>
                  <SectionLabel theme={theme}>Cuisines</SectionLabel>
                  <View style={styles.chipWrap}>
                    {CUISINE_OPTIONS.map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        size="sm"
                        selected={cuisinePrefs.some((x) => x.toLowerCase() === c.toLowerCase())}
                        onPress={() => toggleCuisine(c)}
                      />
                    ))}
                  </View>
                  {cuisinePrefs.filter((c) => !CUISINE_OPTIONS.some((o) => o.toLowerCase() === c.toLowerCase())).length > 0 ? (
                    <View style={[styles.chipWrap, { marginTop: theme.spacing.sm }]}>
                      {cuisinePrefs
                        .filter((c) => !CUISINE_OPTIONS.some((o) => o.toLowerCase() === c.toLowerCase()))
                        .map((c) => (
                          <Chip key={c} label={c} size="sm" selected onPress={() => toggleCuisine(c)} />
                        ))}
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.inputRow,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md },
                    ]}
                  >
                    <IconSymbol name="fork.knife" size={15} color={theme.colors.textTertiary} fallbackGlyph="🍴" />
                    <TextInput
                      value={cuisineDraft}
                      onChangeText={setCuisineDraft}
                      onSubmitEditing={addCuisine}
                      placeholder="Add a cuisine…"
                      placeholderTextColor={theme.colors.textTertiary}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                    {cuisineDraft.trim() ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Add cuisine" hitSlop={8} onPress={addCuisine}>
                        <Text variant="footnote" weight="600" tone="accent">
                          Add
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={[styles.foodToggleRow, styles.field]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="subhead" weight="600">
                      Quick bites
                    </Text>
                    <Text variant="caption" tone="onGlassSecondary">
                      Favour fast, nearby food over long sit-downs.
                    </Text>
                  </View>
                  <Switch
                    value={quickBites}
                    onValueChange={toggleQuickBites}
                    trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                    thumbColor={theme.colors.surfaceElevated}
                    ios_backgroundColor={theme.colors.border}
                  />
                </View>
              </>
            ) : null}
          </GlassCard>
        </View>
      </ScrollView>

      {/* Sticky glass CTA bar */}
      <View
        style={[styles.cta, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: theme.spacing.xl }]}
        onLayout={onCtaLayout}
      >
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

      <DayOptionsSheet visible={showDayOptions} onClose={() => setShowDayOptions(false)} />
    </View>
  );
}

function OnboardCell({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.onboardCell}>
      <Text style={styles.onboardEmoji}>{emoji}</Text>
      <Text variant="caption" tone="onGlass" weight="600" align="center" style={{ marginTop: 4 }}>
        {text}
      </Text>
    </View>
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
  onboardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  onboardCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  onboardEmoji: {
    fontSize: 22,
  },
  onboardDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  suggestLabel: {
    marginTop: 18,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  dropdown: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  datePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayOptionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  dayOptionsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
