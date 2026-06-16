/**
 * Gnaver design system — "Map-first Minimal".
 *
 * Apple-native foundation: white/graphite surfaces, a single electric-blue
 * accent, SF Pro type, generous radii, and soft elevation for cards that float
 * over a full-bleed map. One source of truth for both light and dark schemes.
 */

import { Platform } from 'react-native';

export type Scheme = 'light' | 'dark';

export interface Palette {
  /** App background (behind the map / scrolling content). */
  background: string;
  /** Elevated surfaces — cards, sheets, the floating glass panels. */
  surface: string;
  surfaceElevated: string;
  /** Hairlines and dividers. */
  border: string;
  /** Text. */
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** The single brand accent. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Semantic. */
  success: string;
  warning: string;
  danger: string;
  /** Translucent fills used over the map. */
  glass: string;
  glassBorder: string;
  /** Map route line. */
  route: string;
  pin: string;
  pinFood: string;
  shadow: string;
}

const ELECTRIC_BLUE = '#0A84FF';

export const palettes: Record<Scheme, Palette> = {
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: 'rgba(0,0,0,0.08)',
    text: '#0B1014',
    textSecondary: '#3C4853',
    textTertiary: '#8A95A1',
    accent: ELECTRIC_BLUE,
    accentSoft: 'rgba(10,132,255,0.12)',
    onAccent: '#FFFFFF',
    success: '#2FB463',
    warning: '#E8920C',
    danger: '#E5484D',
    glass: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.6)',
    route: ELECTRIC_BLUE,
    pin: ELECTRIC_BLUE,
    pinFood: '#FF7A00',
    shadow: 'rgba(11,16,20,0.18)',
  },
  dark: {
    background: '#0A0C0F',
    surface: '#15191E',
    surfaceElevated: '#1C2127',
    border: 'rgba(255,255,255,0.10)',
    text: '#F4F6F8',
    textSecondary: '#AEB7C2',
    textTertiary: '#6B7480',
    accent: '#3D9BFF',
    accentSoft: 'rgba(61,155,255,0.18)',
    onAccent: '#04121F',
    success: '#37C97A',
    warning: '#F2A93B',
    danger: '#FF6A6F',
    glass: 'rgba(20,25,30,0.66)',
    glassBorder: 'rgba(255,255,255,0.12)',
    route: '#3D9BFF',
    pin: '#3D9BFF',
    pinFood: '#FF9633',
    shadow: 'rgba(0,0,0,0.5)',
  },
};

/** 4-pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Corner radii — iOS leans generous. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

/** Type scale, SF Pro on iOS. weight as RN fontWeight strings. */
export const typography = {
  family: SYSTEM_FONT,
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: 0.37 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0.35 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.43 },
  body: { fontSize: 17, lineHeight: 23, fontWeight: '400' as const },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

/** Soft elevation for floating cards. */
export const elevation = (scheme: Scheme) => ({
  card: {
    shadowColor: palettes[scheme].shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
  float: {
    shadowColor: palettes[scheme].shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 14,
  },
});

export const motion = {
  spring: { damping: 18, stiffness: 200, mass: 1 },
  springSoft: { damping: 22, stiffness: 140, mass: 1 },
  durationFast: 180,
  duration: 260,
  durationSlow: 420,
} as const;

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: ReturnType<typeof elevation>;
  motion: typeof motion;
}

export function buildTheme(scheme: Scheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
    spacing,
    radius,
    typography,
    elevation: elevation(scheme),
    motion,
  };
}
