/**
 * Small static label chip for categories / metadata (non-interactive).
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';

type Tone = 'neutral' | 'accent' | 'food' | 'success' | 'warning' | 'danger';

export interface TagProps {
  label: string;
  tone?: Tone;
  icon?: SFSymbol;
  iconFallback?: string;
  emoji?: string;
  style?: StyleProp<ViewStyle>;
}

export function Tag({ label, tone = 'neutral', icon, iconFallback, emoji, style }: TagProps) {
  const theme = useTheme();

  const palette = (): { bg: string; fg: string } => {
    switch (tone) {
      case 'accent':
        return { bg: theme.colors.accentSoft, fg: theme.colors.accent };
      case 'food':
        return { bg: `${theme.colors.pinFood}22`, fg: theme.colors.pinFood };
      case 'success':
        return { bg: `${theme.colors.success}22`, fg: theme.colors.success };
      case 'warning':
        return { bg: `${theme.colors.warning}22`, fg: theme.colors.warning };
      case 'danger':
        return { bg: `${theme.colors.danger}22`, fg: theme.colors.danger };
      default:
        return { bg: theme.colors.background, fg: theme.colors.textSecondary };
    }
  };

  const { bg, fg } = palette();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderRadius: theme.radius.sm },
        tone === 'neutral' && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
        style,
      ]}
    >
      {emoji ? (
        <Text variant="caption">{emoji}</Text>
      ) : icon ? (
        <IconSymbol name={icon} size={12} color={fg} fallbackGlyph={iconFallback} />
      ) : null}
      <Text variant="caption" weight="600" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
