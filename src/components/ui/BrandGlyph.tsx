/**
 * BrandGlyph — the single Gnaver mark used everywhere in-app (home header,
 * loading overlay, empty states). It mirrors the app icon exactly: the flat
 * white pin (assets/images/logo-mark.png) on the electric-blue brand gradient,
 * so every surface shows the same modern, minimalist logo.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme';

const MARK = require('../../../assets/images/logo-mark.png');

export interface BrandGlyphProps {
  /** Tile edge length in px. */
  size?: number;
  /** Corner radius; defaults to ~29% of size (matches the app icon). */
  radius?: number;
  /** Drop a soft card shadow under the tile. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BrandGlyph({ size = 48, radius, elevated = true, style }: BrandGlyphProps) {
  const theme = useTheme();
  const r = radius ?? Math.round(size * 0.29);
  return (
    <LinearGradient
      colors={theme.gradients.brand as unknown as readonly [string, string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { width: size, height: size, borderRadius: r, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        elevated ? theme.elevation.card : null,
        style,
      ]}
    >
      {/* Specular top edge — the same liquid-glass sheen the header tile had. */}
      <View pointerEvents="none" style={[styles.spec, { backgroundColor: theme.colors.glassStroke }]} />
      <Image source={MARK} style={{ width: size * 0.6, height: size * 0.6 }} contentFit="contain" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  spec: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.7,
  },
});
