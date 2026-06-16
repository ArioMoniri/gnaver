/**
 * Settings — a modal of persisted defaults. Everything here pre-fills the New
 * Trip screen and is stored via the settings store (AsyncStorage-backed).
 */
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeProviders, features } from '@/services';
import { formatMinutes, type FoodBudget, type Pace, type TransportMode } from '@/core';
import { useTheme } from '@/theme';
import { useSettings } from '@/store/settingsStore';
import {
  ALL_INTERESTS,
  Button,
  Card,
  Chip,
  IconSymbol,
  Screen,
  Segmented,
  Stepper,
  Tag,
  Text,
  interestMeta,
} from '@/components';

const HOUR_STEP = 30;

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

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

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
            <Field label="Food budget" theme={theme}>
              <Segmented<FoodBudget> options={BUDGET_OPTIONS} value={s.foodBudget} onChange={(foodBudget) => s.set({ foodBudget })} />
            </Field>
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
          <FeatureRow label="Places & routing" live={features.livePlaces} liveLabel="Google" mockLabel="Sample data" theme={theme} />
          <FeatureRow label="Weather" live={features.liveWeather} liveLabel="Open-Meteo" mockLabel="Mock" theme={theme} />
          <FeatureRow label="Taste recommender" live={features.liveTaste} liveLabel="LLM" mockLabel="Heuristic" theme={theme} />
        </Section>

        {/* About */}
        <Section title="About" theme={theme}>
          <Card padding="lg" radius="lg" bordered elevated={false}>
            <View style={styles.aboutRow}>
              <Text variant="headline">Gnaver</Text>
              <Tag label="v1.0.0" tone="accent" />
            </View>
            <Text variant="footnote" tone="secondary" style={{ marginTop: 4 }}>
              A map-first travel-itinerary optimizer. Designed & built by Ario Moniri.
            </Text>
          </Card>
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
      <Text variant="title2">{title}</Text>
      {subtitle ? (
        <Text variant="footnote" tone="secondary" style={{ marginTop: 2, marginBottom: theme.spacing.md }}>
          {subtitle}
        </Text>
      ) : (
        <View style={{ height: theme.spacing.md }} />
      )}
      {children}
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
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md, color: theme.colors.text },
      ]}
    />
  );
}

function FeatureRow({
  label,
  live,
  liveLabel,
  mockLabel,
  theme,
}: {
  label: string;
  live: boolean;
  liveLabel: string;
  mockLabel: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.featureRow, { borderColor: theme.colors.border }]}>
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
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
