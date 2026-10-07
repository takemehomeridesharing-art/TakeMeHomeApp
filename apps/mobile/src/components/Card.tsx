import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { makeStyles } from '@/theme';

export interface CardProps extends ViewProps {
  /** `elevated` (white + soft shadow, default), `outlined` (white + hairline), `tinted` (indigo wash). */
  variant?: 'elevated' | 'outlined' | 'tinted';
  /** Inner padding (default 16). Pass 0 for edge-to-edge content. */
  padding?: number;
  /** Makes the card pressable. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** White rounded surface (radius 20) for grouping content. */
export function Card({ variant = 'elevated', padding = 16, onPress, style, children, ...rest }: CardProps) {
  const s = useStyles();
  const base = [s.card, s[variant], { padding }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed ? s.pressed : null]} {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { borderRadius: t.radius.lg, backgroundColor: t.colors.surface },
  elevated: { ...t.shadows.md },
  outlined: { borderWidth: 1, borderColor: t.colors.line },
  tinted: { backgroundColor: t.colors.tint },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
}));
