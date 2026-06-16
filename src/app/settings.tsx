/**
 * Settings — a modal of persisted defaults. Everything here pre-fills the New
 * Trip screen and is stored via the settings store (AsyncStorage-backed).
 */
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeProviders, features, runtimeKeys } from '@/services';
import type { RuntimeKeyName } from '@/services';
import { formatMinutes, type FoodBudget, type MealKind, type Pace, type TransportMode } from '@/core';
import { useTheme } from '@/theme';
import { useSettings } from '@/store/settingsStore';
import {
  ALL_INTERESTS,
  Button,
  Chip,
  GlassCard,
  IconSymbol,
  Screen,
  Segmented,
  Stepper,
  Tag,
  Text,
  hapticImpact,
  hapticSelection,
  ImpactFeedbackStyle,
  interestMeta,
} from '@/components';

const HOUR_STEP = 30;

const LLM_PROVIDER_OPTIONS: { value: 'anthropic' | 'openai'; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
];

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

const toArray = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useSettings();

  // Local state for API keys — seeded from runtimeKeys.all() and kept in sync.
  const [keyState, setKeyState] = useState<Partial<Record<RuntimeKeyName, string>>>(() => runtimeKeys.all());
  // Incrementing counter forces a re-read of describeProviders() / features after edits.
  const [keyVersion, setKeyVersion] = useState(0);

  const setKey = useCallback((name: RuntimeKeyName, value: string) => {
    runtimeKeys.set(name, value);
    setKeyState(runtimeKeys.all());
    setKeyVersion((v) => v + 1);
  }, []);

  const clearKeys = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Medium);
    runtimeKeys.clear();
    setKeyState({});
    setKeyVersion((v) => v + 1);
  }, []);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const toggleMeal = useCallback(
    (meal: MealKind) => {
      hapticSelection();
      const has = s.meals.includes(meal);
      s.set({ meals: has ? s.meals.filter((m) => m !== meal) : [...s.meals, meal] });
    },
    [s],
  );

  // Re-read live provider status on each render after key edits.
  const providerDesc = describeProviders();
  void keyVersion; // referenced so lint doesn't strip it

  return (
    <Screen title="Settings" onBack={close} backVariant="close" edgeToEdgeBottom>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Gnaver Pro upgrade row */}
        <ProBannerRow onPress={() => router.push('/paywall')} theme={theme} />

        {/* API Keys */}
        <Section title="Your API keys" subtitle="Bring your own keys — free forever" theme={theme}>
          {/* Helper copy */}
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="footnote" tone="secondary">
              Keys stay on this device, never uploaded. Without keys, Gnaver uses realistic sample data.
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
              <Pressable onPress={() => void Linking.openURL('https://console.cloud.google.com')}>
                <Text variant="footnote" tone="accent">Get Google key ↗</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL('https://console.anthropic.com')}>
                <Text variant="footnote" tone="accent">Get Anthropic key ↗</Text>
              </Pressable>
            </View>
          </View>

          {/* Live/mock badge summary */}
          <View style={[styles.featureRow, { marginBottom: theme.spacing.lg }]}>
            <IconSymbol
              name={features.livePlaces ? 'dot.radiowaves.left.and.right' : 'circle.dashed'}
              size={14}
              color={features.livePlaces ? theme.colors.success : theme.colors.textTertiary}
              fallbackGlyph={features.livePlaces ? '📡' : '○'}
            />
            <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>{providerDesc}</Text>
          </View>

          <KeyField
            label="Google Maps Platform"
            placeholder="AIza…"
            value={keyState.googleApiKey ?? ''}
            live={features.livePlaces}
            liveLabel="Live"
            onChangeText={(v) => setKey('googleApiKey', v)}
            theme={theme}
          />

          <Field label="LLM provider" theme={theme}>
            <Segmented<'anthropic' | 'openai'>
              options={LLM_PROVIDER_OPTIONS}
              value={(keyState.llmProvider as 'anthropic' | 'openai') ?? 'anthropic'}
              onChange={(v) => { hapticSelection(); setKey('llmProvider', v); }}
            />
          </Field>

          <KeyField
            label="LLM API key"
            placeholder={keyState.llmProvider === 'openai' ? 'sk-…' : 'sk-ant-…'}
            value={keyState.llmApiKey ?? ''}
            live={features.liveTaste}
            liveLabel="Live"
            onChangeText={(v) => setKey('llmApiKey', v)}
            theme={theme}
          />

          <Field label="Model (optional)" theme={theme}>
            <TextInput
              defaultValue={keyState.llmModel ?? ''}
              placeholder="claude-haiku-4-5-20251001"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              onEndEditing={(e) => setKey('llmModel', e.nativeEvent.text)}
              style={[
                styles.input,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.md, color: theme.colors.text },
              ]}
            />
          </Field>

          <Button
            title="Clear keys"
            variant="danger"
            size="sm"
            icon="trash"
            iconFallback="🗑"
            haptic="impact"
            onPress={clearKeys}
            style={{ alignSelf: 'flex-start', marginTop: theme.spacing.xs }}
          />
        </Section>

        {/* Defaults */}
        <Section title="Defaults" subtitle="Pre-fill every new trip" theme={theme}>
          <Field label="Interests" theme={theme}>
            <View style={styles.chipWrap}>
              {ALL_INTERESTS.map((i) => {
                const m = interestMeta(i);
                return (
                  <Chip
                    key={i}
                    label={m.label}
                    emoji={m.emoji}
                    size="sm"
                    selected={s.interests.includes(i)}
                    onPress={() => s.toggleInterest(i)}
                  />
                );
              })}
            </View>
          </Field>

          <Field label="Getting around" theme={theme}>
            <Segmented<TransportMode>
              options={TRANSPORT_OPTIONS}
              value={s.transport}
              onChange={(transport) => s.set({ transport })}
            />
          </Field>

          <Field label="Pace" theme={theme}>
            <Segmented<Pace> options={PACE_OPTIONS} value={s.pace} onChange={(pace) => s.set({ pace })} />
          </Field>

          <View style={styles.stepperField}>
            <Stepper label="Days" value={s.defaultDays} min={1} max={14} onChange={(defaultDays) => s.set({ defaultDays })} />
          </View>
          <View style={styles.stepperField}>
            <Stepper
              label="Start the day"
              value={s.defaultStartMinutes}
              min={5 * 60}
              max={s.defaultEndMinutes - HOUR_STEP}
              step={HOUR_STEP}
              format={formatMinutes}
              onChange={(m) => s.set({ defaultStartMinutes: m })}
            />
          </View>
          <View style={styles.stepperField}>
            <Stepper
              label="End the day"
              value={s.defaultEndMinutes}
              min={s.defaultStartMinutes + HOUR_STEP}
              max={24 * 60}
              step={HOUR_STEP}
              format={formatMinutes}
              onChange={(m) => s.set({ defaultEndMinutes: m })}
            />
          </View>

          <View style={[styles.switchRow, styles.stepperField]}>
            <View style={{ flex: 1 }}>
              <Text variant="subhead" weight="600">
                Include food stops
              </Text>
              <Text variant="caption" tone="secondary">
                Cafés and restaurants around mealtimes.
              </Text>
            </View>
            <Switch
              value={s.includeFood}
              onValueChange={(includeFood) => s.set({ includeFood })}
              trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              thumbColor={theme.colors.surfaceElevated}
              ios_backgroundColor={theme.colors.border}
            />
          </View>

          {s.includeFood ? (
            <>
              <Field label="Meals to include" theme={theme}>
                <View style={styles.chipWrap}>
                  {MEAL_OPTIONS.map((m) => (
                    <Chip
                      key={m.value}
                      label={m.label}
                      emoji={m.emoji}
                      size="sm"
                      selected={s.meals.includes(m.value)}
                      onPress={() => toggleMeal(m.value)}
                    />
                  ))}
                </View>
              </Field>
              <Field label="Food budget" theme={theme}>
                <Segmented<FoodBudget> options={BUDGET_OPTIONS} value={s.foodBudget} onChange={(foodBudget) => s.set({ foodBudget })} />
              </Field>
            </>
          ) : null}

          <Field label="Cuisine preferences" theme={theme}>
            <CommaInput
              value={s.cuisinePrefs.join(', ')}
              placeholder="e.g. ramen, seafood, vegetarian"
              onCommit={(text) => s.set({ cuisinePrefs: toArray(text) })}
              theme={theme}
            />
          </Field>
          <Field label="Dietary needs" theme={theme}>
            <CommaInput
              value={s.dietary.join(', ')}
              placeholder="e.g. vegetarian, gluten-free"
              onCommit={(text) => s.set({ dietary: toArray(text) })}
              theme={theme}
            />
          </Field>
        </Section>

        {/* Weather sensitivity */}
        <Section title="Weather sensitivity" subtitle="When to avoid the outdoors" theme={theme}>
          <View style={[styles.switchRow, { marginBottom: theme.spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Text variant="subhead" weight="600">
                Avoid the rain
              </Text>
              <Text variant="caption" tone="secondary">
                Prefer indoor stops on wet days.
              </Text>
            </View>
            <Switch
              value={s.avoidRain}
              onValueChange={(avoidRain) => s.set({ avoidRain })}
              trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              thumbColor={theme.colors.surfaceElevated}
              ios_backgroundColor={theme.colors.border}
            />
          </View>
          <View style={styles.stepperField}>
            <Stepper
              label="Too hot above"
              value={s.avoidOutdoorAboveC}
              min={20}
              max={45}
              format={(v) => `${v}°C`}
              onChange={(avoidOutdoorAboveC) => s.set({ avoidOutdoorAboveC })}
            />
          </View>
          <View style={styles.stepperField}>
            <Stepper
              label="Too cold below"
              value={s.avoidOutdoorBelowC}
              min={-10}
              max={15}
              format={(v) => `${v}°C`}
              onChange={(avoidOutdoorBelowC) => s.set({ avoidOutdoorBelowC })}
            />
          </View>
        </Section>

        {/* Data sources */}
        <Section title="Data sources" subtitle={describeProviders()} theme={theme}>
          <FeatureRow label="Places & routing" live={features.livePlaces} liveLabel="Google" mockLabel="Sample data" first theme={theme} />
          <FeatureRow label="Weather" live={features.liveWeather} liveLabel="Open-Meteo" mockLabel="Mock" theme={theme} />
          <FeatureRow label="Taste recommender" live={features.liveTaste} liveLabel="LLM" mockLabel="Heuristic" theme={theme} />
        </Section>

        {/* About */}
        <Section title="About" theme={theme}>
          <View style={styles.aboutRow}>
            <Text variant="headline">Gnaver</Text>
            <Tag label="v1.0.0" tone="accent" />
          </View>
          <Text variant="footnote" tone="onGlassSecondary" style={{ marginTop: 4 }}>
            A map-first travel-itinerary optimizer. Designed & built by Ario Moniri.
          </Text>
          <Button
            title="Reset to defaults"
            variant="ghost"
            onPress={() => s.reset()}
            style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}
          />
        </Section>
      </ScrollView>
    </Screen>
  );
}

/** Subtle Pro upgrade banner at the top of Settings. */
function ProBannerRow({
  onPress,
  theme,
}: {
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Upgrade to Gnaver Pro"
      onPress={() => { hapticSelection(); onPress(); }}
    >
      <GlassCard padding="md" radius="xl">
        <View style={styles.proBannerRow}>
          <View style={[styles.proIconWrap, { backgroundColor: theme.colors.accentSoft }]}>
            <IconSymbol name="sparkles" size={20} color={theme.colors.accent} fallbackGlyph="✨" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline" weight="700">Gnaver Pro</Text>
            <Text variant="footnote" tone="secondary">No key setup · hosted AI · unlimited cities</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Tag label="Soon" tone="accent" />
            <IconSymbol name="chevron.right" size={14} color={theme.colors.textTertiary} fallbackGlyph="›" />
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

/** Key field with a live/mock badge. */
function KeyField({
  label,
  placeholder,
  value,
  live,
  liveLabel,
  onChangeText,
  theme,
}: {
  label: string;
  placeholder: string;
  value: string;
  live: boolean;
  liveLabel: string;
  onChangeText: (v: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View style={[styles.keyLabelRow, { marginBottom: theme.spacing.sm }]}>
        <Text
          variant="caption"
          tone="tertiary"
          weight="600"
          style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
        >
          {label}
        </Text>
        <Tag label={live ? liveLabel : 'Sample data'} tone={live ? 'success' : 'neutral'} />
      </View>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={onChangeText}
        style={[
          styles.input,
          { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.md, color: theme.colors.text },
        ]}
      />
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
  theme,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View>
      <Text variant="title2" style={{ marginLeft: theme.spacing.xs }}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          variant="footnote"
          tone="secondary"
          style={{ marginTop: 2, marginBottom: theme.spacing.md, marginLeft: theme.spacing.xs }}
        >
          {subtitle}
        </Text>
      ) : (
        <View style={{ height: theme.spacing.md }} />
      )}
      <GlassCard padding="lg" radius="xl">
        {children}
      </GlassCard>
    </View>
  );
}

function Field({
  label,
  children,
  theme,
}: {
  label: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Text
        variant="caption"
        tone="tertiary"
        weight="600"
        style={{ marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function CommaInput({
  value,
  placeholder,
  onCommit,
  theme,
}: {
  value: string;
  placeholder: string;
  onCommit: (text: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <TextInput
      defaultValue={value}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textTertiary}
      autoCapitalize="none"
      onEndEditing={(e) => onCommit(e.nativeEvent.text)}
      style={[
        styles.input,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.md, color: theme.colors.text },
      ]}
    />
  );
}

function FeatureRow({
  label,
  live,
  liveLabel,
  mockLabel,
  first,
  theme,
}: {
  label: string;
  live: boolean;
  liveLabel: string;
  mockLabel: string;
  first?: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.featureRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }]}>
      <IconSymbol
        name={live ? 'dot.radiowaves.left.and.right' : 'circle.dashed'}
        size={16}
        color={live ? theme.colors.success : theme.colors.textTertiary}
        fallbackGlyph={live ? '📡' : '○'}
      />
      <Text variant="subhead" style={{ flex: 1 }}>
        {label}
      </Text>
      <Tag label={live ? liveLabel : mockLabel} tone={live ? 'success' : 'neutral'} />
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepperField: {
    marginBottom: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    height: 46,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
