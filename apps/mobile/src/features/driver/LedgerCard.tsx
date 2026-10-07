import { formatRwf, type Ledger } from '@tmh/shared';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon, Text } from '@/components';
import { makeStyles } from '@/theme';

export interface LedgerCardProps {
  ledger: Ledger;
  /** Seats offered, for the explanation line. */
  seatsOffered: number;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The cost-sharing ledger: what the trip costs to run, what paid passengers have recovered and the
 * share the driver still carries. The bar is the trip cost; the hatched tail beyond `maxRecovery`
 * is the part no passenger can ever cover (the no-profit rule).
 */
export function LedgerCard({ ledger, seatsOffered, title = 'Cost-sharing ledger', style }: LedgerCardProps) {
  const s = useStyles();
  const cost = Math.max(ledger.tripCost, 1);
  const recoveredPct = Math.min(ledger.recovered / cost, 1) * 100;
  const capPct = Math.min(ledger.maxRecovery / cost, 1) * 100;
  const minShare = ledger.tripCost - ledger.maxRecovery;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(recoveredPct, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [recoveredPct, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  return (
    <View style={[s.card, style]} testID="ledger-card">
      <View style={s.titleRow}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" color="ink3">
          {formatRwf(ledger.runningCostPerKm)}/km
        </Text>
      </View>

      <View style={s.figures}>
        <Figure label="Trip cost" hint="What this drive costs to run" value={formatRwf(ledger.tripCost)} />
        <Figure
          label="Recovered so far"
          hint="Contributions from paid passengers"
          value={formatRwf(ledger.recovered)}
          tone="accent"
          testID="ledger-recovered"
        />
        <Figure label="Share you still carry" value={formatRwf(ledger.driverCarries)} tone="primary" testID="ledger-carries" last />
      </View>

      <View style={s.barWrap}>
        <View style={s.track}>
          <View style={[s.never, { left: `${capPct}%` }]}>
            {Array.from({ length: 12 }, (_, i) => (
              <View key={i} style={s.stripe} />
            ))}
          </View>
          <Animated.View style={[s.fill, fillStyle]} />
        </View>
        <View style={[s.capMarker, { left: `${capPct}%` }]} />
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.swatch, s.swatchFill]} />
            <Text variant="caption">Recovered</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.swatch, s.swatchCap]} />
            <Text variant="caption">Most you can recover · {formatRwf(ledger.maxRecovery)}</Text>
          </View>
        </View>
      </View>

      <View style={s.note}>
        <Icon name="leaf" size={16} color="accentInk" />
        <Text variant="caption" color="accentInk" style={s.noteText}>
          Even with every seat filled you carry at least {formatRwf(minShare)} — that&apos;s the no-profit rule. Each passenger covers their share of the
          running cost
          {seatsOffered ? ` ÷ (${seatsOffered} seats + you)` : ''}; booking fees go to the platform, never to you.
        </Text>
      </View>
    </View>
  );
}

function Figure({
  label,
  hint,
  value,
  tone,
  testID,
  last,
}: {
  label: string;
  hint?: string;
  value: string;
  tone?: 'accent' | 'primary';
  testID?: string;
  last?: boolean;
}) {
  const s = useStyles();
  return (
    <View style={[s.figure, last ? null : s.figureDivider]} testID={testID}>
      <View style={[s.dot, tone === 'accent' ? s.dotAccent : tone === 'primary' ? s.dotPrimary : null]} />
      <View style={s.figureTexts}>
        <Text variant={last ? 'bodyStrong' : 'body'}>{label}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <Text style={[s.figureValue, tone === 'accent' ? s.valueAccent : tone === 'primary' ? s.valuePrimary : null]} numberOfLines={1}>
        {value}
      </Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  figures: {
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.sm,
    paddingHorizontal: 12,
  },
  figure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  figureDivider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  figureTexts: { flex: 1, gap: 0 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.colors.ink3,
  },
  dotAccent: { backgroundColor: t.colors.accent },
  dotPrimary: { backgroundColor: t.colors.primary },
  figureValue: {
    fontFamily: t.fonts.headingHeavy,
    fontSize: 18,
    lineHeight: 24,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  valueAccent: { color: t.colors.accentInk },
  valuePrimary: { color: t.colors.primary },
  barWrap: { gap: 8 },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: t.colors.tint,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 7,
    backgroundColor: t.colors.accent,
  },
  never: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    gap: 5,
    backgroundColor: t.colors.line,
    overflow: 'hidden',
    paddingLeft: 3,
  },
  stripe: {
    width: 2,
    height: 30,
    marginTop: -8,
    backgroundColor: t.colors.surface,
    opacity: 0.8,
    transform: [{ rotate: '35deg' }],
  },
  capMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 20,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: t.colors.ink2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  swatchFill: { backgroundColor: t.colors.accent },
  swatchCap: {
    backgroundColor: t.colors.line,
    borderWidth: 1,
    borderColor: t.colors.ink3,
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
