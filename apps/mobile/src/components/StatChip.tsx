import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface StatChipProps {
  label: string;
  value: string;
  icon?: IconName;
  /** `neutral` (grey wash), `primary` (indigo), `accent` (amber, money), `success` (mint). */
  tone?: 'neutral' | 'primary' | 'accent' | 'success';
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<NonNullable<StatChipProps['tone']>, { bg: keyof ColorTokens; fg: keyof ColorTokens }> = {
  neutral: { bg: 'bg', fg: 'ink2' },
  primary: { bg: 'tint', fg: 'primary' },
  accent: { bg: 'accent2', fg: 'accentInk' },
  success: { bg: 'mint', fg: 'success' },
};

/** Small labelled stat block: caption label over an Archivo value (e.g. Seat · 1, Distance · 6.4 km). */
export function StatChip({ label, value, icon, tone = 'neutral', style }: StatChipProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const t = TONES[tone];
  return (
    <View style={[s.chip, { backgroundColor: colors[t.bg] }, style]}>
      <View style={s.labelRow}>
        {icon ? <Icon name={icon} size={13} color={t.fg} /> : null}
        <Text variant="caption" style={{ color: colors[t.fg] }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={s.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  chip: { flexGrow: 1, minWidth: 92, paddingHorizontal: 12, paddingVertical: 10, borderRadius: t.radius.sm, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { fontFamily: t.fonts.heading, fontSize: 16, lineHeight: 22, color: t.colors.ink },
}));
