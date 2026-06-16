/**
 * SF Symbol wrapper. Renders a crisp native symbol on iOS and a graceful text
 * glyph fallback everywhere else, so call-sites never have to branch on platform.
 */
import { useMemo } from 'react';
import { Platform, Text, type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';

export interface IconSymbolProps {
  name: SFSymbol;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  /** Glyph shown on Android / web where SF Symbols are unavailable. */
  fallbackGlyph?: string;
  style?: StyleProp<ViewStyle>;
}

/** A tiny set of fallbacks for the handful of symbols used in chrome / labels. */
const FALLBACK_GLYPHS: Partial<Record<string, string>> = {
  'chevron.left': '‹',
  'chevron.right': '›',
  'chevron.down': '⌄',
  xmark: '✕',
  'gearshape.fill': '⚙',
  gearshape: '⚙',
  'magnifyingglass': '⌕',
  plus: '+',
  minus: '−',
  checkmark: '✓',
  'checkmark.circle.fill': '✓',
  'arrow.right': '→',
  'arrow.triangle.2.circlepath': '↻',
  'map.fill': '🗺',
  'fork.knife': '🍴',
  'figure.walk': '🚶',
  'tram.fill': '🚊',
  'car.fill': '🚗',
  'bicycle': '🚲',
  'doc.on.doc': '⧉',
  'link': '🔗',
  'sparkles': '✨',
  'cloud.rain.fill': '🌧',
  'sun.max.fill': '☀',
  'clock': '🕐',
  'star.fill': '★',
  'mappin': '📍',
  'mappin.circle.fill': '📍',
};

export function IconSymbol({
  name,
  size = 20,
  color,
  weight = 'regular',
  fallbackGlyph,
  style,
}: IconSymbolProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.text;

  const fallbackNode = useMemo(() => {
    const glyph = fallbackGlyph ?? FALLBACK_GLYPHS[name] ?? '•';
    return (
      <Text
        accessibilityElementsHidden
        style={{ fontSize: size, lineHeight: size * 1.1, color: tint } satisfies TextStyle}
      >
        {glyph}
      </Text>
    );
  }, [fallbackGlyph, name, size, tint]);

  if (Platform.OS !== 'ios') {
    return <View style={style}>{fallbackNode}</View>;
  }

  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={tint}
      weight={weight}
      fallback={fallbackNode}
      style={[{ width: size, height: size }, style]}
    />
  );
}
