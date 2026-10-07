import { MAX_TRIPS_PER_DAY } from '@tmh/shared';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '@/theme';
import { Text } from './Text';

export interface TwoTripMeterProps {
  /** Trips already published for the day. */
  used: number;
  limit?: number;
  /** Day wording for the label (default `today`): `1 of 2 trips today`. */
  dayLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const SEGMENT_LABELS = ['Out', 'Back'];

/** The "one out, one back" daily limit meter: one segment per allowed trip, filled as trips are used. */
export function TwoTripMeter({ used, limit = MAX_TRIPS_PER_DAY, dayLabel = 'today', style }: TwoTripMeterProps) {
  const s = useStyles();
  const full = used >= limit;
  return (
    <View style={[s.wrap, style]} accessibilityLabel={`${used} of ${limit} trips ${dayLabel}`}>
      <View style={s.header}>
        <Text variant="caption" color="ink" style={s.title}>
          {Math.min(used, limit)} of {limit} trips {dayLabel}
        </Text>
        {full ? (
          <Text variant="caption" color="accentInk">
            Daily limit reached
          </Text>
        ) : null}
      </View>
      <View style={s.segments}>
        {Array.from({ length: limit }, (_, i) => (
          <View key={i} style={s.segmentCol}>
            <View style={[s.segment, i < used ? (full ? s.filledFull : s.filled) : null]} />
            <Text variant="caption" color={i < used ? 'ink' : 'ink3'} style={s.segmentLabel}>
              {SEGMENT_LABELS[i] ?? `Trip ${i + 1}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: t.fonts.bodySemiBold },
  segments: { flexDirection: 'row', gap: 6 },
  segmentCol: { flex: 1, gap: 4 },
  segment: { height: 10, borderRadius: 5, backgroundColor: t.colors.line },
  filled: { backgroundColor: t.colors.primary },
  filledFull: { backgroundColor: t.colors.accent },
  segmentLabel: { fontSize: 12 },
}));
