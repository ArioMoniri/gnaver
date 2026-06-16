/**
 * Horizontal day selector. Each chip shows "Day N", a short date, and a compact
 * weather temp. The active chip fills with the accent; tapping fires a haptic.
 */
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatDateLabel, type DayPlan } from '@/core';
import { useTheme } from '@/theme';
import { Text, WeatherPill, hapticSelection } from '@/components/ui';

export interface DayTabStripProps {
  days: DayPlan[];
  activeDay: number;
  onSelect: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function DayTabStrip({ days, activeDay, onSelect, style, contentStyle }: DayTabStripProps) {
  const theme = useTheme();

  const select = useCallback(
    (i: number) => {
      if (i === activeDay) return;
      hapticSelection();
      onSelect(i);
    },
    [activeDay, onSelect],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {days.map((day, i) => {
        const active = i === activeDay;
        const dateLabel = formatDateLabel(day.date).split(', ')[1] ?? day.date;
        return (
          <Pressable
            key={day.date}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => select(i)}
            style={[
              styles.chip,
              {
                borderRadius: theme.radius.lg,
                backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              },
              active ? theme.elevation.card : undefined,
            ]}
          >
            <Text
              variant="footnote"
              weight="700"
              style={{ color: active ? theme.colors.onAccent : theme.colors.text }}
            >
              Day {i + 1}
            </Text>
            <Text
              variant="caption"
              style={{ color: active ? theme.colors.onAccent : theme.colors.textSecondary, opacity: active ? 0.9 : 1 }}
            >
              {dateLabel}
            </Text>
            {day.weather ? (
              active ? (
                <Text variant="caption" weight="600" style={{ color: theme.colors.onAccent, marginTop: 2 }}>
                  {Math.round(day.weather.tempMaxC)}°
                </Text>
              ) : (
                <View style={{ marginTop: 2 }}>
                  <WeatherPill weather={day.weather} compact />
                </View>
              )
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  chip: {
    minWidth: 78,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 1,
  },
});
