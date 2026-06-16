/**
 * Generic segmented control with a sliding selection pill. Typed over the option
 * value so call-sites stay type-safe (e.g. TransportMode, Pace, a string union).
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { hapticSelection } from './haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
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

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.background,
          borderRadius: theme.radius.md,
          padding: 3,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: `${100 / count}%`,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md - 3,
            transform: [{ translateX: translate }],
          },
          theme.elevation.card,
        ]}
      />
      {options.map((opt) => {
        const active = opt.value === value;
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
            <Text
              variant="subhead"
              weight={active ? '600' : '500'}
              style={{ color: active ? theme.colors.text : theme.colors.textSecondary }}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    zIndex: 1,
  },
});
