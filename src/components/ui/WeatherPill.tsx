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
import { GlassSurface } from './GlassCard';

export interface WeatherPillProps {
  weather?: DayWeather;
  /** Compact form: just symbol + max temp (used on the day strip). */
  compact?: boolean;
  /** Float the full pill over the map as Liquid Glass. */
  glass?: boolean;
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

export function WeatherPill({ weather, compact = false, glass = false, style }: WeatherPillProps) {
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

  const body = (
    <>
      <IconSymbol name={sym.name} size={15} color={theme.colors.accent} fallbackGlyph={sym.glyph} />
      <Text variant="footnote" weight="600" tone={glass ? 'onGlass' : 'primary'}>
        {max}°
      </Text>
      <Text variant="footnote" tone={glass ? 'onGlassSecondary' : 'tertiary'}>
        / {min}°
      </Text>
      {wet ? (
        <Text variant="footnote" tone={glass ? 'onGlassSecondary' : 'secondary'}>
          · {Math.round(weather.precipitationProbability)}% rain
        </Text>
      ) : null}
    </>
  );

  if (glass) {
    return (
      <GlassSurface variant="chip" radius="pill" padding="none" sheen={false} style={style}>
        <View style={styles.glassPad}>{body}</View>
      </GlassSurface>
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
      {body}
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
  glassPad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
