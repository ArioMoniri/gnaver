/**
 * The one button. Five intents, an optional leading/trailing SF Symbol, a loading
 * state, and a restrained press-spring + haptic on every tap.
 *
 *   primary   → brand gradient fill (gradients.brand) with a specular top edge.
 *   secondary → Liquid Glass surface (the glass primitive) with accent label.
 *   ghost     → text-only, accent label.
 *   danger    → solid danger fill.
 *   glass     → neutral glass chrome with primary-text label (over-map controls).
 */
import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { GlassSurface } from './GlassCard';
import { hapticImpact, hapticSelection, ImpactFeedbackStyle } from './haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
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
        damping: theme.motion.springBouncy.damping,
        stiffness: theme.motion.springBouncy.stiffness,
        mass: theme.motion.springBouncy.mass,
      }).start();
    },
    [scale, theme.motion.springBouncy],
  );

  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 50;
  const paddingH = size === 'sm' ? theme.spacing.lg : theme.spacing.xl;
  const fontVariant = size === 'sm' ? 'subhead' : 'headline';

  const fg =
    variant === 'primary' || variant === 'danger'
      ? theme.colors.onAccent
      : variant === 'glass'
        ? theme.colors.onGlass
        : theme.colors.accent;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={styles.content}>
      {icon && !trailingIcon ? (
        <IconSymbol name={icon} size={18} color={fg} fallbackGlyph={iconFallback} weight="semibold" />
      ) : null}
      <Text variant={fontVariant} weight="600" style={{ color: fg }} numberOfLines={1}>
        {title}
      </Text>
      {icon && trailingIcon ? (
        <IconSymbol name={icon} size={18} color={fg} fallbackGlyph={iconFallback} weight="semibold" />
      ) : null}
    </View>
  );

  const innerCommon: ViewStyle = {
    height,
    paddingHorizontal: paddingH,
    alignItems: 'center',
    justifyContent: 'center',
  };

  // ── Brand-gradient inner for primary, with a specular top hairline. ─────────
  const renderInner = () => {
    if (variant === 'primary') {
      return (
        <LinearGradient
          colors={theme.gradients.brand as unknown as readonly [ColorValue, ColorValue, ColorValue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[innerCommon, { borderRadius: theme.radius.pill, overflow: 'hidden' }, theme.elevation.card]}
        >
          <View pointerEvents="none" style={[styles.specular, { backgroundColor: theme.colors.glassStroke }]} />
          {content}
        </LinearGradient>
      );
    }
    if (variant === 'danger') {
      return (
        <View style={[innerCommon, { borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger }, theme.elevation.card]}>
          {content}
        </View>
      );
    }
    if (variant === 'ghost') {
      return <View style={[innerCommon, { paddingHorizontal: theme.spacing.md }]}>{content}</View>;
    }
    // secondary + glass → the real glass material.
    return (
      <GlassSurface
        variant="chip"
        interactive
        radius="pill"
        padding="none"
        sheen={false}
        style={{ borderRadius: theme.radius.pill }}
      >
        <View style={innerCommon}>{content}</View>
      </GlassSurface>
    );
  };

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
        onPressIn={() => animateTo(0.95)}
        onPressOut={() => animateTo(1)}
        style={styles.base}
      >
        {renderInner()}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
