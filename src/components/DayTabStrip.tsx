/**
 * Horizontal day selector that floats over the map. Each chip shows "Day N", a
 * short date, and a compact weather temp. The active chip fills with the brand
 * gradient; unselected chips are real Liquid Glass so they stay legible over the
 * map. Tapping fires a haptic and springs the press.
 */
import { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { formatDateLabel, type DayPlan } from '@/core';
import { useTheme } from '@/theme';
import { Text, WeatherPill, GlassSurface, hapticSelection } from '@/components/ui';

export interface DayTabStripProps {
  days: DayPlan[];
  activeDay: number;
  onSelect: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function DayTabStrip({ days, activeDay, onSelect, style, contentStyle }: DayTabStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {days.map((day, i) => (
        <DayChip
          key={day.date}
          index={i}
          date={day.date}
          weather={day.weather}
          active={i === activeDay}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

function DayChip({
  index,
  date,
  weather,
  active,
  onSelect,
}: {
  index: number;
  date: string;
  weather: DayPlan['weather'];
  active: boolean;
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const dateLabel = formatDateLabel(date).split(', ')[1] ?? date;

  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      damping: theme.motion.springBouncy.damping,
      stiffness: theme.motion.springBouncy.stiffness,
      mass: theme.motion.springBouncy.mass,
    }).start();

  const select = useCallback(() => {
    if (active) return;
    hapticSelection();
    onSelect(index);
  }, [active, index, onSelect]);

  const inner = (
    <View style={styles.chipInner}>
      <Text variant="footnote" weight="700" style={{ color: active ? theme.colors.onAccent : theme.colors.onGlass }}>
        Day {index + 1}
      </Text>
      <Text
        variant="caption"
        style={{ color: active ? theme.colors.onAccent : theme.colors.onGlassSecondary, opacity: active ? 0.92 : 1 }}
      >
        {dateLabel}
      </Text>
      {weather ? (
        active ? (
          <Text variant="caption" weight="600" style={{ color: theme.colors.onAccent, marginTop: 2 }}>
            {Math.round(weather.tempMaxC)}°
          </Text>
        ) : (
          <View style={{ marginTop: 2 }}>
            <WeatherPill weather={weather} compact />
          </View>
        )
      ) : null}
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={select}
        onPressIn={() => animateTo(0.95)}
        onPressOut={() => animateTo(1)}
      >
        {active ? (
          <LinearGradient
            colors={theme.gradients.brand as unknown as readonly [ColorValue, ColorValue, ColorValue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.chip, { borderRadius: theme.radius.lg, overflow: 'hidden' }, theme.elevation.glass]}
          >
            <View pointerEvents="none" style={[styles.specular, { backgroundColor: theme.colors.glassStroke }]} />
            {inner}
          </LinearGradient>
        ) : (
          <GlassSurface variant="panel" interactive radius="lg" padding="none" floating>
            <View style={styles.chip}>{inner}</View>
          </GlassSurface>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    minWidth: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipInner: {
    alignItems: 'center',
    gap: 1,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.6,
  },
});
