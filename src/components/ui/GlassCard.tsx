/**
 * GlassSurface — the one canonical Liquid Glass primitive the whole app composes
 * its chrome from. It implements a three-step material cascade so the "glass over
 * the map" language holds identically on every target:
 *
 *   1. iOS 26 + isLiquidGlassAvailable()  → real `GlassView` (expo-glass-effect).
 *        'regular' for panels/chips, 'clear' for thin bars; tinted with
 *        theme.colors.glassTint; isInteractive for tappable chrome; colorScheme
 *        pinned to our theme so a manual toggle stays correct.
 *   2. other iOS / the iOS 18.4 simulator → `BlurView` (expo-blur) with the
 *        scheme-matched system material tint, over a translucent glass fill — a
 *        genuinely frosted fallback, not a flat panel.
 *   3. web / anything else                → translucent themed View.
 *
 * In every case it overlays a 1px specular top highlight (theme.colors.glassStroke),
 * an optional faint top-down `gradients.sheen` for the wet-glass look, a hairline
 * border (glassBorder) and — when floating — the `elevation.glass` ambient shadow.
 *
 * Crash-safe: availability is probed once behind try/catch; web never touches the
 * native modules. `GlassCard` is kept as a thin alias so existing call-sites keep
 * working unchanged.
 */
import { type ReactNode, useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView, type BlurTint } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme, type Theme } from '@/theme';

/** panel = primary frosted surface · bar = thin translucent chrome · chip = compact tappable pill. */
export type GlassVariant = 'panel' | 'bar' | 'chip';

type RadiusToken = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'glass' | 'pill';
type PaddingToken = 'none' | 'sm' | 'md' | 'lg';

export interface GlassSurfaceProps {
  children?: ReactNode;
  variant?: GlassVariant;
  /** Tappable chrome — enables the native interactive glass highlight. */
  interactive?: boolean;
  /** Drop the wide ambient glass shadow (use for chrome floating over content). */
  floating?: boolean;
  radius?: RadiusToken;
  padding?: PaddingToken;
  /** Drop the faint top-down sheen gradient (e.g. for very small chips). */
  sheen?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Probe the real Liquid Glass material once, never crash on non-iOS. */
const liquidGlassReady = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
};

const PADDING: Record<PaddingToken, (t: Theme) => number> = {
  none: () => 0,
  sm: (t) => t.spacing.md,
  md: (t) => t.spacing.lg,
  lg: (t) => t.spacing.xxl,
};

/** Frosted-glass blur tint that matches the active scheme + material weight. */
function blurTint(scheme: 'light' | 'dark', variant: GlassVariant): BlurTint {
  if (scheme === 'dark') {
    return variant === 'bar' ? 'systemUltraThinMaterialDark' : 'systemThinMaterialDark';
  }
  return variant === 'bar' ? 'systemUltraThinMaterialLight' : 'systemThinMaterialLight';
}

function blurIntensity(variant: GlassVariant): number {
  // Thin bars stay lighter so map detail reads through; panels frost harder.
  return variant === 'bar' ? 44 : variant === 'chip' ? 56 : 64;
}

export function GlassSurface({
  children,
  variant = 'panel',
  interactive = false,
  floating = false,
  radius,
  padding = 'md',
  sheen = true,
  style,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const available = useMemo(liquidGlassReady, []);

  const radiusToken: RadiusToken = radius ?? (variant === 'chip' ? 'pill' : 'glass');
  const borderRadius = theme.radius[radiusToken];
  const pad = PADDING[padding](theme);
  const shadow = floating ? theme.elevation.glass : undefined;

  // Shared decorative overlays: specular top hairline + optional wet-glass sheen.
  // pointerEvents none so they never intercept touches on interactive surfaces.
  const overlays = (
    <>
      {sheen ? (
        <LinearGradient
          pointerEvents="none"
          colors={theme.gradients.sheen as unknown as readonly [ColorValue, ColorValue]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.85 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          styles.specular,
          { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius, backgroundColor: theme.colors.glassStroke },
        ]}
      />
    </>
  );

  const contentBox: ViewStyle = { borderRadius, padding: pad, overflow: 'hidden' };

  // ── 1 · Real Liquid Glass ──────────────────────────────────────────────────
  if (available) {
    return (
      <View style={[shadow, style]}>
        <GlassView
          glassEffectStyle={variant === 'bar' ? 'clear' : 'regular'}
          tintColor={theme.colors.glassTint}
          isInteractive={interactive}
          colorScheme={theme.scheme}
          style={contentBox}
        >
          {overlays}
          {children}
        </GlassView>
      </View>
    );
  }

  // ── 2 · Frosted-glass BlurView fallback (incl. iOS 18.4 simulator) ──────────
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return (
      <View style={[shadow, style]}>
        <BlurView
          tint={blurTint(theme.scheme, variant)}
          intensity={blurIntensity(variant)}
          experimentalBlurMethod="dimezisBlurView"
          style={[
            contentBox,
            styles.border,
            { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder },
          ]}
        >
          {overlays}
          {children}
        </BlurView>
      </View>
    );
  }

  // ── 3 · Web / other: translucent themed surface ─────────────────────────────
  return (
    <View
      style={[
        contentBox,
        styles.border,
        { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder },
        shadow,
        style,
      ]}
    >
      {overlays}
      {children}
    </View>
  );
}

// ── Back-compat alias ─────────────────────────────────────────────────────────
// Existing screens import `GlassCard` with { padding, radius, floating }. Map the
// old radius union onto the new token set and default to the 'panel' material.
export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: PaddingToken;
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  floating?: boolean;
  variant?: GlassVariant;
  interactive?: boolean;
}

export function GlassCard({ radius, variant = 'panel', ...rest }: GlassCardProps) {
  return <GlassSurface variant={variant} radius={radius} {...rest} />;
}

const styles = StyleSheet.create({
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.9,
  },
});
