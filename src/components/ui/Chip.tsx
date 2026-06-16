/**
 * Selectable pill. Used for interests, cuisines, quick filters.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
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
  style,
}: ChipProps) {
  const theme = useTheme();

  const press = useCallback(() => {
    if (disabled) return;
    hapticSelection();
    onPress?.();
  }, [disabled, onPress]);

  const paddingV = size === 'sm' ? theme.spacing.xs + 2 : theme.spacing.sm;
  const paddingH = size === 'sm' ? theme.spacing.md : theme.spacing.lg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={press}
      disabled={disabled}
      style={[
        styles.base,
        {
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          borderRadius: theme.radius.pill,
          backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
        },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <View style={styles.row}>
        {emoji ? (
          <Text variant={size === 'sm' ? 'footnote' : 'subhead'}>{emoji}</Text>
        ) : icon ? (
          <IconSymbol name={icon} size={15} color={selected ? theme.colors.onAccent : theme.colors.textSecondary} />
        ) : null}
        <Text
          variant={size === 'sm' ? 'footnote' : 'subhead'}
          weight="600"
          style={{ color: selected ? theme.colors.onAccent : theme.colors.text }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
