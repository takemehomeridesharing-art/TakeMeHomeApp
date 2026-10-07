import { type VerificationChips as Chips } from '@tmh/shared';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type VerificationKey = keyof Chips;

export interface VerificationChipsProps {
  chips: Chips;
  /** Which chips to show, in order (default all five). */
  show?: VerificationKey[];
  /** Hide chips in state `none`. */
  hideNone?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LABELS: Record<VerificationKey, string> = { phone: 'Phone', email: 'Email', id: 'ID', licence: 'Licence', vehicle: 'Vehicle' };
const STATES: Record<Chips[VerificationKey], { icon: IconName; bg: keyof ColorTokens; fg: keyof ColorTokens; a11y: string }> = {
  verified: { icon: 'checkmark-circle', bg: 'mint', fg: 'success', a11y: 'verified' },
  pending: { icon: 'time', bg: 'accent2', fg: 'accentInk', a11y: 'pending review' },
  none: { icon: 'ellipse-outline', bg: 'bg', fg: 'ink3', a11y: 'not verified' },
};

/** Trust chips: Phone ✓ / Email / ID / Licence / Vehicle — verified (green tick), pending (amber), none (grey). */
export function VerificationChips({ chips, show = ['phone', 'email', 'id', 'licence', 'vehicle'], hideNone = false, style }: VerificationChipsProps) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.row, style]}>
      {show
        .filter((key) => !(hideNone && chips[key] === 'none'))
        .map((key) => {
          const st = STATES[chips[key]];
          return (
            <View key={key} style={[s.chip, { backgroundColor: colors[st.bg] }, chips[key] === 'none' ? s.none : null]} accessibilityLabel={`${LABELS[key]} ${st.a11y}`}>
              <Icon name={st.icon} size={14} color={st.fg} />
              <Text variant="caption" style={[s.text, { color: chips[key] === 'none' ? colors.ink2 : colors[st.fg] }]}>
                {LABELS[key]}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: t.radius.pill },
  none: { borderWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.surface },
  text: { fontFamily: t.fonts.bodySemiBold, fontSize: 12 },
}));
