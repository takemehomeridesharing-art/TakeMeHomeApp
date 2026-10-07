import { bookingFeeFor, computeContribution, driverRecoveryCap, formatKm, formatRwf, round1, RUNNING_COST_PER_KM, type CorridorStop } from '@tmh/shared';
import { View } from 'react-native';
import { Icon, Text } from '@/components';
import { makeStyles } from '@/theme';

export interface PricePreviewProps {
  /** The served corridor (from `buildCorridor`). */
  corridor: readonly CorridorStop[];
  /** Place id → display name. */
  nameOf: (placeId: string) => string;
  seatsOffered: number;
  isEV: boolean;
}

interface SegmentRow {
  key: string;
  label: string;
  km: number;
  costShare: number;
}

/** Sample passenger segments for a corridor: every stop → destination, then origin → each intermediate stop. */
function sampleSegments(corridor: readonly CorridorStop[], nameOf: (id: string) => string, seats: number): SegmentRow[] {
  const last = corridor[corridor.length - 1]!;
  const first = corridor[0]!;
  const rows: SegmentRow[] = [];
  const add = (a: CorridorStop, b: CorridorStop) => {
    const km = round1(b.cumulativeKm - a.cumulativeKm);
    if (km <= 0 || rows.some((r) => r.key === `${a.placeId}-${b.placeId}`)) return;
    rows.push({
      key: `${a.placeId}-${b.placeId}`,
      label: `${nameOf(a.placeId)} → ${nameOf(b.placeId)}`,
      km,
      costShare: computeContribution({
        segmentKm: km,
        seatsOffered: seats,
        isEV: false,
      }).costShare,
    });
  };
  corridor.slice(0, -1).forEach((st) => add(st, last));
  corridor.slice(1, -1).forEach((st) => add(first, st));
  return rows.slice(0, 6);
}

/**
 * Live capped-price preview: the formula with the real numbers, per-segment examples and the
 * driver's recovery cap. Drivers never set prices — this only shows what the engine will charge.
 */
export function PricePreview({ corridor, nameOf, seatsOffered, isEV }: PricePreviewProps) {
  const s = useStyles();
  if (corridor.length < 2) return null;
  const totalKm = corridor[corridor.length - 1]!.cumulativeKm;
  if (!(totalKm > 0)) return null;
  const perSeat = computeContribution({
    segmentKm: totalKm,
    seatsOffered,
    isEV,
  }).costShare;
  const cap = driverRecoveryCap({ totalKm, seatsOffered });
  const fee = bookingFeeFor(isEV);
  const rows = sampleSegments(corridor, nameOf, seatsOffered);

  return (
    <View style={s.card} testID="price-preview">
      <View style={s.head}>
        <Text variant="label">Contribution per seat</Text>
        <View style={s.capped}>
          <Icon name="lock-closed" size={11} color="accentInk" />
          <Text variant="caption" color="accentInk" style={s.cappedText}>
            Capped
          </Text>
        </View>
      </View>

      <View style={s.hero}>
        <Text style={s.heroValue} testID="price-per-seat">
          {formatRwf(perSeat)}
        </Text>
        <Text variant="caption">per seat for the full route</Text>
      </View>

      <View style={s.formula}>
        <Icon name="calculator-outline" size={16} color="ink2" />
        <Text variant="caption" color="ink" style={s.formulaText} testID="price-formula">
          {formatRwf(RUNNING_COST_PER_KM)}/km × {formatKm(totalKm)} ÷ ({seatsOffered} seat{seatsOffered === 1 ? '' : 's'} + 1) = {formatRwf(perSeat)} per seat
          for the full route
        </Text>
      </View>

      <View style={s.table}>
        <View style={s.tableHead}>
          <Text variant="caption" style={s.colRoute}>
            If someone rides…
          </Text>
          <Text variant="caption" style={s.colKm}>
            Distance
          </Text>
          <Text variant="caption" style={s.colAmt}>
            They chip in
          </Text>
        </View>
        {rows.map((r) => (
          <View key={r.key} style={s.tableRow}>
            <Text variant="caption" color="ink" numberOfLines={1} style={s.colRoute}>
              {r.label}
            </Text>
            <Text variant="caption" style={s.colKm}>
              {formatKm(r.km)}
            </Text>
            <Text style={[s.amt, s.colAmt]}>{formatRwf(r.costShare)}</Text>
          </View>
        ))}
        <Text variant="caption" color="ink3">
          + {formatRwf(fee)} booking fee per passenger{isEV ? ' (EV rate)' : ''} — that goes to the platform, never to you.
        </Text>
      </View>

      <View style={s.note} testID="price-cap">
        <Icon name="leaf" size={16} color="accentInk" />
        <Text variant="caption" color="accentInk" style={s.noteText}>
          If every seat is taken for the whole route you recover {formatRwf(cap.maxRecovery)} of {formatRwf(cap.tripCost)} — you still carry{' '}
          {formatRwf(cap.driverMinimumShare)}. You&apos;re an occupant too, so you can never profit.
        </Text>
      </View>
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
    gap: 14,
    ...t.shadows.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.colors.accent2,
    borderRadius: t.radius.pill,
    paddingHorizontal: 8,
    height: 22,
  },
  cappedText: { fontFamily: t.fonts.bodyBold, fontSize: 11 },
  hero: { gap: 0 },
  heroValue: {
    fontFamily: t.fonts.headingHeavy,
    fontSize: 34,
    lineHeight: 40,
    color: t.colors.accentInk,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  formula: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.sm,
    padding: 12,
    alignItems: 'flex-start',
  },
  formulaText: { flex: 1, fontFamily: t.fonts.bodySemiBold },
  table: { gap: 8 },
  tableHead: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.line,
    paddingBottom: 6,
  },
  tableRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  colRoute: { flex: 1 },
  colKm: { width: 60, textAlign: 'right' },
  colAmt: { width: 84, textAlign: 'right' },
  amt: {
    fontFamily: t.fonts.heading,
    fontSize: 14,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: t.colors.accent2,
    borderRadius: t.radius.sm,
    padding: 12,
  },
  noteText: { flex: 1 },
}));
