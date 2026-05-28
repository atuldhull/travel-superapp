/**
 * Theme provider + useTheme hook.
 *
 * Exposes the `@app/aether-motion` `theme` object via React context.
 * In Phase 0 every consumer reads the locked Warm Italian palette;
 * Phase 6 per-destination palettes will substitute `theme.color` at
 * the provider level.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { theme as defaultTheme, type Theme } from '@app/aether-motion';

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** Override the locked theme — used for per-destination palettes (Phase 6)
   *  or Storybook variant pickers. Phase 0 callers should not pass this. */
  theme?: Theme;
  children: ReactNode;
}

export function ThemeProvider({
  theme = defaultTheme,
  children,
}: ThemeProviderProps): React.ReactElement {
  // Memoise so identical theme references don't trigger context re-renders.
  const value = useMemo(() => theme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Read the theme. Throws outside provider so misuse is loud, not silent. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error(
      'useTheme() called outside <ThemeProvider>. Wrap your tree in ' +
        '<AetherProvider> at the app root.',
    );
  }
  return ctx;
}
