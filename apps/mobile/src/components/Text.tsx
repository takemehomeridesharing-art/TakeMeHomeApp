import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme, type ColorTokens, type TextVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  /** Typographic role. Headings, numbers (`money`) and `display` use Archivo; the rest Public Sans. */
  variant?: TextVariant;
  /** Theme colour token. Defaults to `ink` (`ink2` for caption/label). */
  color?: keyof ColorTokens;
  align?: TextStyle['textAlign'];
}

const DEFAULT_COLOR: Partial<Record<TextVariant, keyof ColorTokens>> = { caption: 'ink2', label: 'ink2' };

/** Themed text. `<Text variant="h2">Your trips</Text>`, `<Text variant="money" color="accentInk">RWF 610</Text>`. */
export function Text({ variant = 'body', color, align, style, ...rest }: TextProps) {
  const t = useTheme();
  return (
    <RNText
      {...rest}
      style={[t.text[variant], { color: t.colors[color ?? DEFAULT_COLOR[variant] ?? 'ink'] }, align ? { textAlign: align } : null, style]}
    />
  );
}
