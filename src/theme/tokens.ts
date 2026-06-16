/**
 * Gnaver design system — "Map-first · Liquid Glass".
 *
 * Apple iOS-26 foundation: a single electric-blue accent, SF Pro type, deep
 * map-first canvases, and real Liquid Glass chrome (expo-glass-effect) layered
 * over content with vibrancy, specular edges and soft gradient sheen. One source
 * of truth for both light and dark schemes.
 */

import { Platform } from 'react-native';

export type Scheme = 'light' | 'dark';

export interface Palette {
  /** App background (behind the map / scrolling content). */
  background: string;
  /** Secondary canvas wash (gradient end / grouped sections). */
  backgroundElevated: string;
  /** Elevated opaque surfaces — cards, sheets. */
  surface: string;
  surfaceElevated: string;
  /** Hairlines and dividers. */
  border: string;
  /** Text. */
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** The single brand accent + a deeper companion for gradients. */
  accent: string;
  accentDeep: string;
  accentSoft: string;
  onAccent: string;
  /** Semantic. */
  success: string;
  warning: string;
  danger: string;
  /** Liquid Glass tuning. `glass`/`glassBorder` are the non-OS fallback fill. */
  glass: string;
  glassBorder: string;
  /** tintColor handed to GlassView for a subtle scheme-aware wash. */
  glassTint: string;
  /** Specular top-edge highlight drawn on glass chrome. */
  glassStroke: string;
  /** Text colors tuned for legibility over Liquid Glass. */
  onGlass: string;
  onGlassSecondary: string;
  /** Scrim for darkening the map under floating glass. */
  scrim: string;
  /** Map route line + pins. */
  route: string;
  pin: string;
  pinFood: string;
  pinGlow: string;
  shadow: string;
}

const ELECTRIC_BLUE = '#0A84FF';

export const palettes: Record<Scheme, Palette> = {
  light: {
    background: '#EFF3F8',
    backgroundElevated: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: 'rgba(12,18,28,0.08)',
    text: '#0B1014',
    textSecondary: '#46535F',
    textTertiary: '#8A95A1',
    accent: ELECTRIC_BLUE,
    accentDeep: '#0060DF',
    accentSoft: 'rgba(10,132,255,0.12)',
    onAccent: '#FFFFFF',
    success: '#1FAF5A',
    warning: '#E8920C',
    danger: '#E5484D',
    glass: 'rgba(255,255,255,0.62)',
    glassBorder: 'rgba(255,255,255,0.75)',
    glassTint: 'rgba(255,255,255,0.30)',
    glassStroke: 'rgba(255,255,255,0.85)',
    onGlass: '#0B1014',
    onGlassSecondary: 'rgba(11,16,20,0.62)',
    scrim: 'rgba(8,14,22,0.24)',
    route: ELECTRIC_BLUE,
    pin: ELECTRIC_BLUE,
    pinFood: '#FF7A00',
    pinGlow: 'rgba(10,132,255,0.35)',
    shadow: 'rgba(10,22,40,0.20)',
  },
  dark: {
    background: '#070A0E',
    backgroundElevated: '#0D1218',
    surface: '#13181F',
    surfaceElevated: '#1A2028',
    border: 'rgba(255,255,255,0.10)',
    text: '#F4F6F8',
    textSecondary: '#AEB7C2',
    textTertiary: '#6B7480',
    accent: '#3D9BFF',
    accentDeep: '#0A6FE0',
    accentSoft: 'rgba(61,155,255,0.20)',
    onAccent: '#03121F',
    success: '#37C97A',
    warning: '#F2A93B',
    danger: '#FF6A6F',
    glass: 'rgba(22,28,36,0.58)',
    glassBorder: 'rgba(255,255,255,0.14)',
    glassTint: 'rgba(20,26,34,0.40)',
    glassStroke: 'rgba(255,255,255,0.22)',
    onGlass: '#F4F6F8',
    onGlassSecondary: 'rgba(244,246,248,0.66)',
    scrim: 'rgba(0,0,0,0.42)',
    route: '#4FA8FF',
    pin: '#4FA8FF',
    pinFood: '#FF9633',
    pinGlow: 'rgba(79,168,255,0.40)',
    shadow: 'rgba(0,0,0,0.55)',
  },
};

/** Multi-stop gradients for hero canvases, brand fills and glass sheen. */
export interface Gradients {
  /** Brand accent fill (buttons, hero marks). */
  brand: readonly [string, string, string];
  /** Subtle app-background wash behind the map / content. */
  hero: readonly [string, string];
  /** Top-down sheen overlaid on glass chrome for a wet-glass highlight. */
  sheen: readonly [string, string];
  /** Soft accent halo (selection, focus, pin glow). */
  accentWash: readonly [string, string];
}

export const gradients: Record<Scheme, Gradients> = {
  light: {
    brand: ['#2AA6FF', '#0A84FF', '#0060DF'],
    hero: ['#FBFDFF', '#E7EEF7'],
    sheen: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.04)'],
    accentWash: ['rgba(10,132,255,0.16)', 'rgba(10,132,255,0.0)'],
  },
  dark: {
    brand: ['#56ABFF', '#3D9BFF', '#0A6FE0'],
    hero: ['#0E141B', '#06090D'],
    sheen: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.0)'],
    accentWash: ['rgba(79,168,255,0.22)', 'rgba(79,168,255,0.0)'],
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

/** Corner radii — iOS leans generous; `glass` is the concentric chrome radius. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 34,
  glass: 26,
  pill: 999,
} as const;

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

/** Type scale, SF Pro on iOS. weight as RN fontWeight strings. */
export const typography = {
  family: SYSTEM_FONT,
  hero: { fontSize: 40, lineHeight: 44, fontWeight: '800' as const, letterSpacing: 0.4 },
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

/** Soft elevation for floating chrome. `glass` is a crisp, wide ambient shadow. */
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
  glass: {
    shadowColor: palettes[scheme].shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 34,
    elevation: 18,
  },
});

export const motion = {
  spring: { damping: 18, stiffness: 200, mass: 1 },
  springSoft: { damping: 22, stiffness: 140, mass: 1 },
  springBouncy: { damping: 13, stiffness: 180, mass: 0.9 },
  durationFast: 180,
  duration: 260,
  durationSlow: 420,
} as const;

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  gradients: Gradients;
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
    gradients: gradients[scheme],
    spacing,
    radius,
    typography,
    elevation: elevation(scheme),
    motion,
  };
}
