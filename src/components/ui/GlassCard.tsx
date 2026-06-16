/**
 * Floating glass panel. Uses the real Liquid Glass material when the OS supports
 * it; otherwise falls back to a translucent themed surface with a hairline border
 * so the "glass over the map" language holds on every platform.
 */
import { type ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useTheme } from '@/theme';

export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Inner padding preset. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Corner radius token. Defaults to `lg`. */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  /** Drop a soft float shadow under the panel. */
  floating?: boolean;
}

const glassAvailable = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
};

export function GlassCard({
  children,
  style,
  padding = 'md',
  radius = 'lg',
  floating = false,
}: GlassCardProps) {
  const theme = useTheme();
  const available = useMemo(glassAvailable, []);

  const pad =
    padding === 'none'
      ? 0
      : padding === 'sm'
        ? theme.spacing.md
        : padding === 'lg'
          ? theme.spacing.xxl
          : theme.spacing.lg;

  const borderRadius = theme.radius[radius];
  const shadow = floating ? theme.elevation.float : theme.elevation.card;

  if (available) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={theme.scheme}
        style={[
          { borderRadius, padding: pad, overflow: 'hidden' },
          floating && shadow,
          style,
        ]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          borderRadius,
          padding: pad,
          backgroundColor: theme.colors.glass,
          borderColor: theme.colors.glassBorder,
        },
        floating && shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
