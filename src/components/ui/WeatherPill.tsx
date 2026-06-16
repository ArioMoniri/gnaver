/**
 * A glanceable weather summary: a condition symbol, the high/low temperature,
 * and a rain-probability hint when it matters. Built from the core DayWeather.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { DayWeather, WeatherCondition } from '@/core';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';

export interface WeatherPillProps {
  weather?: DayWeather;
  /** Compact form: just symbol + max temp (used on the day strip). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SYMBOL: Record<WeatherCondition, { name: SFSymbol; glyph: string }> = {
  clear: { name: 'sun.max.fill', glyph: '☀' },
  clouds: { name: 'cloud.fill', glyph: '☁' },
  rain: { name: 'cloud.rain.fill', glyph: '🌧' },
  snow: { name: 'snowflake', glyph: '❄' },
  storm: { name: 'cloud.bolt.rain.fill', glyph: '⛈' },
  fog: { name: 'cloud.fog.fill', glyph: '🌫' },
  unknown: { name: 'thermometer.medium', glyph: '🌡' },
};

export function WeatherPill({ weather, compact = false, style }: WeatherPillProps) {
  const theme = useTheme();
  if (!weather) return null;

  const sym = SYMBOL[weather.condition] ?? SYMBOL.unknown;
  const max = Math.round(weather.tempMaxC);
  const min = Math.round(weather.tempMinC);
  const wet = weather.precipitationProbability >= 40;

  if (compact) {
    return (
      <View style={[styles.compact, style]}>
        <IconSymbol name={sym.name} size={13} color={theme.colors.textSecondary} fallbackGlyph={sym.glyph} />
        <Text variant="caption" weight="600" tone="secondary">
          {max}°
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: theme.colors.background, borderRadius: theme.radius.pill, borderColor: theme.colors.border },
        style,
      ]}
    >
      <IconSymbol name={sym.name} size={15} color={theme.colors.accent} fallbackGlyph={sym.glyph} />
      <Text variant="footnote" weight="600">
        {max}°
      </Text>
      <Text variant="footnote" tone="tertiary">
        / {min}°
      </Text>
      {wet ? (
        <Text variant="footnote" tone="secondary">
          · {Math.round(weather.precipitationProbability)}% rain
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
