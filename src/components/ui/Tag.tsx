/**
 * Small static label chip for categories / metadata (non-interactive). Tones map
 * to soft tinted fills; pass `glass` to float the tag over the map as real Liquid
 * Glass while keeping the tone-coloured icon + label.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { GlassSurface } from './GlassCard';

type Tone = 'neutral' | 'accent' | 'food' | 'success' | 'warning' | 'danger';

export interface TagProps {
  label: string;
  tone?: Tone;
  icon?: SFSymbol;
  iconFallback?: string;
  emoji?: string;
  /** Float the tag over the map as Liquid Glass. */
  glass?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Tag({ label, tone = 'neutral', icon, iconFallback, emoji, glass = false, style }: TagProps) {
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
        // surfaceElevated (not background) so neutral tags read on a same-color sheet.
        return { bg: theme.colors.surfaceElevated, fg: theme.colors.textSecondary };
    }
  };

  const { bg, fg } = palette();
  const fgGlass = tone === 'neutral' ? theme.colors.onGlass : fg;

  const inner = (
    <View style={styles.row}>
      {emoji ? (
        <Text variant="caption">{emoji}</Text>
      ) : icon ? (
        <IconSymbol name={icon} size={12} color={glass ? fgGlass : fg} fallbackGlyph={iconFallback} />
      ) : null}
      <Text variant="caption" weight="600" style={{ color: glass ? fgGlass : fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (glass) {
    return (
      <GlassSurface variant="chip" radius="sm" padding="none" sheen={false} style={[styles.glassWrap, style]}>
        <View style={styles.pad}>{inner}</View>
      </GlassSurface>
    );
  }

  return (
    <View
      style={[
        styles.base,
        styles.pad,
        { backgroundColor: bg, borderRadius: theme.radius.sm },
        tone === 'neutral' && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
        style,
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
  glassWrap: {
    alignSelf: 'flex-start',
  },
  pad: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
