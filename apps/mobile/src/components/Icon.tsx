import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { useTheme, type ColorTokens } from '@/theme';

/** Any Ionicons glyph name. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** A theme colour token (`'primary'`) or a raw colour. Defaults to `ink`. */
  color?: keyof ColorTokens | (string & {});
  style?: StyleProp<TextStyle>;
}

/** Ionicons glyph coloured from the theme. */
export function Icon({ name, size = 20, color = 'ink', style }: IconProps) {
  const { colors } = useTheme();
  const resolved = (colors as unknown as Record<string, string>)[color] ?? color;
  return <Ionicons name={name} size={size} color={resolved} style={style} />;
}
