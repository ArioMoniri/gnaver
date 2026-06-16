/**
 * Friendly empty / zero-result state with a Lottie pin and an optional action.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { Lottie } from './Lottie';

// Relative path keeps the asset resolvable by Metro regardless of alias config.
const emptyAnimation = require('../../../assets/lottie/empty-state.json');

export interface EmptyStateProps {
  title: string;
  message?: string;
  /** Override the default floating-pin animation. */
  animation?: unknown;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ title, message, animation, action, style }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { padding: theme.spacing.xxl }, style]}>
      <Lottie source={animation ?? emptyAnimation} size={132} loop />
      <View style={{ height: theme.spacing.md }} />
      <Text variant="title2" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="callout" tone="secondary" align="center" style={{ marginTop: theme.spacing.xs }}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.xl }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
