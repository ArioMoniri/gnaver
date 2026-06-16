/**
 * Opaque elevated surface for content that doesn't sit over the map.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  elevated?: boolean;
  bordered?: boolean;
}

export function Card({
  children,
  style,
  padding = 'md',
  radius = 'lg',
  elevated = true,
  bordered = false,
}: CardProps) {
  const theme = useTheme();

  const pad =
    padding === 'none'
      ? 0
      : padding === 'sm'
        ? theme.spacing.md
        : padding === 'lg'
          ? theme.spacing.xxl
          : theme.spacing.lg;

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius[radius],
          padding: pad,
        },
        elevated && theme.elevation.card,
        bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
