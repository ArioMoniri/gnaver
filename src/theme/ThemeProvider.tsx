import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildTheme, type Scheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({
  children,
  forceScheme,
}: {
  children: ReactNode;
  forceScheme?: Scheme;
}) {
  const system = useColorScheme();
  const scheme: Scheme = forceScheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Access the active theme (colors, spacing, radius, typography, elevation, motion). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Memoised stylesheet factory bound to the current theme. */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
