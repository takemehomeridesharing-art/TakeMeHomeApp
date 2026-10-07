import { type TextStyle } from 'react-native';

/**
 * Font families as registered by `useFonts` in `app/_layout.tsx`. Archivo for headings, numbers
 * and the wordmark; Public Sans for everything else. Each weight is its own family on native,
 * so always set `fontFamily` (never `fontWeight`) when changing weight.
 */
export const fonts = {
  heading: 'Archivo_700Bold',
  headingHeavy: 'Archivo_800ExtraBold',
  body: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemiBold: 'PublicSans_600SemiBold',
  bodyBold: 'PublicSans_700Bold',
} as const;

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'money';

/** Text styles for each `<Text variant>` (colour is applied separately). */
export const textVariants: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.headingHeavy, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.headingHeavy, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  money: { fontFamily: fonts.headingHeavy, fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
};
