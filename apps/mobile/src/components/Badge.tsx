import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeKind = 'womenOnly' | 'ev' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps {
  kind: BadgeKind;
  /** Overrides the default label (`Women only`, `EV`). Required for generic kinds. */
  label?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

const KINDS: Record<BadgeKind, { bg: keyof ColorTokens; fg: keyof ColorTokens; icon?: IconName; label?: string }> = {
  womenOnly: { bg: 'tint', fg: 'primary2', icon: 'female', label: 'Women only' },
  ev: { bg: 'accent2', fg: 'accentInk', icon: 'flash', label: 'EV' },
  primary: { bg: 'tint', fg: 'primary' },
  success: { bg: 'mint', fg: 'success' },
  warning: { bg: 'accent2', fg: 'accentInk' },
  danger: { bg: 'coralWash', fg: 'coral' },
  neutral: { bg: 'bg', fg: 'ink2' },
};

/** Small status pill. `<Badge kind="womenOnly" />`, `<Badge kind="ev" />`, `<Badge kind="success" label="Paid" />`. */
export function Badge({ kind, label, icon, style }: BadgeProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const k = KINDS[kind];
  const glyph = icon ?? k.icon;
  return (
    <View style={[s.badge, { backgroundColor: colors[k.bg] }, kind === 'neutral' ? s.neutral : null, style]}>
      {glyph ? <Icon name={glyph} size={12} color={k.fg} /> : null}
      <Text variant="caption" style={[s.text, { color: colors[k.fg] }]}>
        {label ?? k.label ?? ''}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: t.radius.pill,
    alignSelf: 'flex-start',
  },
  neutral: { borderWidth: 1, borderColor: t.colors.line },
  text: { fontFamily: t.fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
}));
