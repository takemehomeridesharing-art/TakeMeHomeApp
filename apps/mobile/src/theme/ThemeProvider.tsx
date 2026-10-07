import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { lightColors, type ColorTokens } from './colors';
import { radius, shadows, space } from './tokens';
import { fonts, textVariants } from './typography';

/** Everything visual a component may depend on. */
export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  fonts: typeof fonts;
  text: typeof textVariants;
  space: typeof space;
  radius: typeof radius;
  shadows: typeof shadows;
}

export const lightTheme: Theme = { dark: false, colors: lightColors, fonts, text: textVariants, space, radius, shadows };

const ThemeContext = createContext<Theme>(lightTheme);

/** Provides the active theme. Only light exists today; pass `theme` to switch later. */
export function ThemeProvider({ theme = lightTheme, children }: { theme?: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The active theme (colours, fonts, spacing, radii, shadows). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Creates a theme-aware style hook, memoised per theme:
 *
 * ```ts
 * const useStyles = makeStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 * function Foo() { const s = useStyles(); return <View style={s.card} />; }
 * ```
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (t: Theme) => T): () => T {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
