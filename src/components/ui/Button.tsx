/**
 * The one button. Four intents, an optional leading SF Symbol, a loading state,
 * and a restrained press-spring + haptic on every tap.
 */
import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { hapticImpact, hapticSelection, ImpactFeedbackStyle } from './haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: SFSymbol;
  iconFallback?: string;
  /** Place the icon after the label instead of before. */
  trailingIcon?: boolean;
  fullWidth?: boolean;
  /** Strength of the haptic on tap. Defaults to selection for secondary/ghost. */
  haptic?: 'selection' | 'impact' | 'none';
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconFallback,
  trailingIcon = false,
  fullWidth = false,
  haptic,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const inactive = disabled || loading;

  const press = useCallback(
    (e: GestureResponderEvent) => {
      const mode = haptic ?? (variant === 'primary' || variant === 'danger' ? 'impact' : 'selection');
      if (mode === 'impact') hapticImpact(ImpactFeedbackStyle.Medium);
      else if (mode === 'selection') hapticSelection();
      onPress?.(e);
    },
    [haptic, onPress, variant],
  );

  const animateTo = useCallback(
    (to: number) => {
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        damping: theme.motion.spring.damping,
        stiffness: theme.motion.spring.stiffness,
        mass: theme.motion.spring.mass,
      }).start();
    },
    [scale, theme.motion.spring],
  );

  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 50;
  const paddingH = size === 'sm' ? theme.spacing.lg : theme.spacing.xl;
  const fontVariant = size === 'sm' ? 'subhead' : 'headline';

  const bg =
    variant === 'primary'
      ? theme.colors.accent
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.accentSoft
          : 'transparent';

  const fg =
    variant === 'primary' || variant === 'danger'
      ? theme.colors.onAccent
      : theme.colors.accent;

  const iconColor = fg;

  return (
    <Animated.View
      style={[
        { transform: [{ scale }], opacity: inactive ? 0.5 : 1 },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={press}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.base,
          {
            height,
            paddingHorizontal: paddingH,
            borderRadius: theme.radius.pill,
            backgroundColor: bg,
          },
          variant === 'ghost' && { paddingHorizontal: theme.spacing.md },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.content}>
            {icon && !trailingIcon && (
              <IconSymbol name={icon} size={18} color={iconColor} fallbackGlyph={iconFallback} weight="semibold" />
            )}
            <Text variant={fontVariant} weight="600" style={{ color: fg }}>
              {title}
            </Text>
            {icon && trailingIcon && (
              <IconSymbol name={icon} size={18} color={iconColor} fallbackGlyph={iconFallback} weight="semibold" />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
