/**
 * −/+ stepper with a label and a formatted value. Holds to the design system's
 * pill controls; clamps to [min, max] and fires a selection haptic per step.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { GlassSurface } from './GlassCard';
import { hapticSelection } from './haptics';

export interface StepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Render the numeric value (e.g. formatMinutes). Defaults to String(value). */
  format?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  format,
  style,
}: StepperProps) {
  const theme = useTheme();

  const clamp = useCallback((n: number) => Math.max(min, Math.min(max, n)), [min, max]);

  const dec = useCallback(() => {
    const next = clamp(value - step);
    if (next !== value) {
      hapticSelection();
      onChange(next);
    }
  }, [clamp, onChange, step, value]);

  const inc = useCallback(() => {
    const next = clamp(value + step);
    if (next !== value) {
      hapticSelection();
      onChange(next);
    }
  }, [clamp, onChange, step, value]);

  const atMin = value <= min;
  const atMax = value >= max;
  const display = format ? format(value) : String(value);

  return (
    <View style={[styles.row, style]}>
      {label ? (
        <Text variant="subhead" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <GlassSurface variant="chip" radius="pill" padding="none" sheen={false} style={{ borderRadius: theme.radius.pill }}>
        <View style={styles.control}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease"
            onPress={dec}
            disabled={atMin}
            style={[styles.btn, atMin && styles.disabled]}
            hitSlop={6}
          >
            <IconSymbol name="minus" size={16} color={theme.colors.onGlass} weight="semibold" />
          </Pressable>
          <View style={styles.valueBox}>
            <Text variant="subhead" weight="700" align="center" tone="onGlass">
              {display}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase"
            onPress={inc}
            disabled={atMax}
            style={[styles.btn, atMax && styles.disabled]}
            hitSlop={6}
          >
            <IconSymbol name="plus" size={16} color={theme.colors.onGlass} weight="semibold" />
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flexShrink: 1,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  valueBox: {
    minWidth: 64,
    paddingHorizontal: 4,
  },
});
