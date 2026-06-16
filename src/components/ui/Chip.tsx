/**
 * Selectable pill. Used for interests, cuisines, quick filters and over-map
 * controls. Selected chips fill with the brand gradient and a specular edge;
 * unselected chips are either a quiet surface or — when `overMap` — real Liquid
 * Glass so they stay legible floating above the map. Press scales with a spring.
 */
import { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { GlassSurface } from './GlassCard';
import { hapticSelection } from './haptics';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: SFSymbol;
  /** Leading emoji (cheap cross-platform glyph). */
  emoji?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Render the unselected state as Liquid Glass (for chips floating over the map). */
  overMap?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  emoji,
  disabled = false,
  size = 'md',
  overMap = false,
  style,
}: ChipProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = useCallback(() => {
    if (disabled) return;
    hapticSelection();
    onPress?.();
  }, [disabled, onPress]);

  const animateTo = useCallback(
    (to: number) => {
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        damping: theme.motion.springBouncy.damping,
        stiffness: theme.motion.springBouncy.stiffness,
        mass: theme.motion.springBouncy.mass,
      }).start();
    },
    [scale, theme.motion.springBouncy],
  );

  const paddingV = size === 'sm' ? theme.spacing.xs + 2 : theme.spacing.sm;
  const paddingH = size === 'sm' ? theme.spacing.md : theme.spacing.lg;
  const labelColor = selected ? theme.colors.onAccent : overMap ? theme.colors.onGlass : theme.colors.text;
  const iconColor = selected ? theme.colors.onAccent : overMap ? theme.colors.onGlass : theme.colors.textSecondary;

  const inner = (
    <View style={[styles.row, { paddingVertical: paddingV, paddingHorizontal: paddingH }]}>
      {emoji ? (
        <Text variant={size === 'sm' ? 'footnote' : 'subhead'}>{emoji}</Text>
      ) : icon ? (
        <IconSymbol name={icon} size={15} color={iconColor} />
      ) : null}
      <Text variant={size === 'sm' ? 'footnote' : 'subhead'} weight="600" style={{ color: labelColor }}>
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.4 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        onPress={press}
        onPressIn={() => animateTo(0.94)}
        onPressOut={() => animateTo(1)}
        disabled={disabled}
        style={styles.press}
      >
        {selected ? (
          <LinearGradient
            colors={theme.gradients.brand as unknown as readonly [ColorValue, ColorValue, ColorValue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fill, { borderRadius: theme.radius.pill }, theme.elevation.card]}
          >
            <View pointerEvents="none" style={[styles.specular, { backgroundColor: theme.colors.glassStroke }]} />
            {inner}
          </LinearGradient>
        ) : overMap ? (
          <GlassSurface variant="chip" interactive radius="pill" padding="none" sheen={false}>
            {inner}
          </GlassSurface>
        ) : (
          <View
            style={[
              styles.fill,
              styles.border,
              { borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            {inner}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  press: {
    borderRadius: 999,
  },
  fill: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  border: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.7,
  },
});
