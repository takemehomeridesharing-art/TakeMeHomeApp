import { type ViewStyle } from 'react-native';

/** Spacing scale (4pt grid). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Corner radii. `pill` for fully rounded chips/buttons. */
export const radius = { sm: 12, md: 16, lg: 20, pill: 999 } as const;

/**
 * Soft shadows as CSS `boxShadow` strings — supported by React Native (new architecture) and
 * react-native-web alike.
 */
export const shadows = {
  none: {} as ViewStyle,
  sm: { boxShadow: '0px 1px 3px rgba(25,28,43,0.06), 0px 2px 8px rgba(25,28,43,0.05)' } as ViewStyle,
  md: { boxShadow: '0px 4px 16px rgba(25,28,43,0.08)' } as ViewStyle,
  lg: { boxShadow: '0px 12px 32px rgba(25,28,43,0.14)' } as ViewStyle,
  /** Coloured glow under primary CTAs. */
  primary: { boxShadow: '0px 6px 16px rgba(67,83,255,0.28)' } as ViewStyle,
} as const;
