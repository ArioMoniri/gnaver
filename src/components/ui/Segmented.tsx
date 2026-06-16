/**
 * Generic segmented control with a sliding selection thumb. Typed over the option
 * value so call-sites stay type-safe (e.g. TransportMode, Pace, a string union).
 *
 * The track is a quiet recessed surface; the thumb is the brand gradient with a
 * specular top edge, sliding on a spring. Over the map, pass `overMap` to render
 * the track as real Liquid Glass.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { GlassSurface } from './GlassCard';
import { hapticSelection } from './haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Render the track as Liquid Glass (for controls floating over the map). */
  overMap?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({ options, value, onChange, overMap = false, style }: SegmentedProps<T>) {
  const theme = useTheme();
  const widthRef = useRef(0);
  const translate = useRef(new Animated.Value(0)).current;

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const count = Math.max(1, options.length);

  const moveTo = useCallback(
    (i: number, animate: boolean) => {
      const seg = widthRef.current / count;
      const to = seg * i;
      if (!animate) {
        translate.setValue(to);
        return;
      }
      Animated.spring(translate, {
        toValue: to,
        useNativeDriver: true,
        damping: theme.motion.spring.damping,
        stiffness: theme.motion.spring.stiffness,
        mass: theme.motion.spring.mass,
      }).start();
    },
    [count, theme.motion.spring, translate],
  );

  useEffect(() => {
    moveTo(index, true);
  }, [index, moveTo]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      widthRef.current = e.nativeEvent.layout.width;
      moveTo(index, false);
    },
    [index, moveTo],
  );

  const segments = (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: `${100 / count}%`,
            borderRadius: theme.radius.md - 1,
            transform: [{ translateX: translate }],
          },
          theme.elevation.card,
        ]}
      >
        <LinearGradient
          colors={theme.gradients.brand as unknown as readonly [ColorValue, ColorValue, ColorValue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.md - 1, overflow: 'hidden' }]}
        >
          <View style={[styles.specular, { backgroundColor: theme.colors.glassStroke }]} />
        </LinearGradient>
      </Animated.View>

      {options.map((opt) => {
        const active = opt.value === value;
        const labelColor = active
          ? theme.colors.onAccent
          : overMap
            ? theme.colors.onGlassSecondary
            : theme.colors.textSecondary;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                hapticSelection();
                onChange(opt.value);
              }
            }}
            style={styles.segment}
          >
            <Text variant="subhead" weight={active ? '700' : '500'} style={{ color: labelColor }} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );

  if (overMap) {
    return (
      <GlassSurface variant="bar" radius="md" padding="none" sheen={false} style={[{ borderRadius: theme.radius.md }, style]}>
        <View onLayout={onLayout} style={[styles.inner, { padding: 4 }]}>
          {segments}
        </View>
      </GlassSurface>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.background,
          borderRadius: theme.radius.md,
          padding: 4,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {segments}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  inner: {
    flexDirection: 'row',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    zIndex: 1,
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
