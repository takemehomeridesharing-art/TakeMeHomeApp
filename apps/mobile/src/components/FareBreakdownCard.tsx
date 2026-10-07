import { formatKm, formatRwf, RUNNING_COST_PER_KM } from '@tmh/shared';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface FareBreakdownCardProps {
  /** Distance the passenger rides (board → alight). */
  segmentKm: number;
  /** Seats the driver offers (the driver counts as +1 occupant). */
  seatsOffered: number;
  costShare: number;
  bookingFee: number;
  total: number;
  /** Shows the reduced EV booking-fee note. */
  isEV?: boolean;
  /** Show the amber no-profit note (default true). */
  showNote?: boolean;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * How a contribution is computed: distance, running-cost formula, cost share, booking fee and
 * total — on a white card with an amber top border, plus the no-profit note.
 */
export function FareBreakdownCard({
  segmentKm,
  seatsOffered,
  costShare,
  bookingFee,
  total,
  isEV = false,
  showNote = true,
  title = 'Your contribution',
  style,
}: FareBreakdownCardProps) {
  const s = useStyles();
  return (
    <View style={[s.card, style]}>
      <Text variant="label" style={s.title}>
        {title}
      </Text>
      <Row label="Distance you ride" value={formatKm(segmentKm)} />
      <View style={s.formula}>
        <Icon name="calculator-outline" size={14} color="ink2" />
        <View style={s.formulaTexts}>
          <Text variant="caption" style={s.formulaText}>
            Running cost {formatRwf(RUNNING_COST_PER_KM)}/km ÷ (seats + 1)
          </Text>
          <Text variant="caption" color="ink" style={s.formulaValue}>
            {formatRwf(RUNNING_COST_PER_KM)} ÷ ({seatsOffered} + 1) = {formatRwf(Math.floor(RUNNING_COST_PER_KM / (seatsOffered + 1)))} per km
          </Text>
        </View>
      </View>
      <Row label="Your cost share" value={formatRwf(costShare)} />
      <Row label={isEV ? 'Booking fee · EV rate' : 'Booking fee'} value={formatRwf(bookingFee)} />
      <View style={s.divider} />
      <View style={s.totalRow}>
        <Text variant="bodyStrong">Total</Text>
        <Text style={s.total}>{formatRwf(total)}</Text>
      </View>
      {showNote ? (
        <View style={s.note}>
          <Icon name="leaf" size={16} color="accentInk" />
          <Text variant="caption" color="accentInk" style={s.noteText}>
            Drivers can&apos;t profit on Take Me Home — this only covers your share of fuel and wear. The driver still carries their own share.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text variant="body" color="ink2">
        {label}
      </Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderTopWidth: 4,
    borderTopColor: t.colors.accent,
    padding: 16,
    gap: 10,
    ...t.shadows.md,
  },
  title: { marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  value: { fontFamily: t.fonts.heading, fontSize: 15, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  formula: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: t.colors.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  formulaTexts: { flex: 1, gap: 1 },
  formulaText: { fontSize: 12, lineHeight: 16 },
  formulaValue: { fontFamily: t.fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
  divider: { height: 1, backgroundColor: t.colors.line, marginVertical: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontFamily: t.fonts.headingHeavy, fontSize: 24, lineHeight: 30, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  note: { flexDirection: 'row', gap: 8, backgroundColor: t.colors.accent2, borderRadius: t.radius.sm, padding: 12, marginTop: 4 },
  noteText: { flex: 1 },
}));
