import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { formatDay } from '@/lib/format';
import { kigaliTime } from '@tmh/shared';
import { makeStyles } from '@/theme';
import { Icon, type IconName } from './Icon';
import { StatChip, type StatChipProps } from './StatChip';
import { Text } from './Text';

export interface TicketProps {
  /** Board stop name. */
  from: string;
  /** Drop-off stop name. */
  to: string;
  fromLandmark?: string;
  toLandmark?: string;
  /** Departure ISO time (Kigali time and day are shown). */
  departureTime: string;
  /** The code the passenger shows the driver. */
  tripCode: string;
  /** Stat chips for the bottom half (seat, distance, paid, car…). */
  stats?: (Pick<StatChipProps, 'label' | 'value' | 'tone'> & { icon?: IconName })[];
  /** Top-right status slot, e.g. `<Badge kind="success" label="Confirmed" />`. */
  status?: ReactNode;
  /** Extra content under the stats (driver row, actions). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const NOTCH = 14;

/** Tear-off ticket: route, time and big trip code on top; perforated divider with notches; stat chips below. */
export function Ticket({ from, to, fromLandmark, toLandmark, departureTime, tripCode, stats = [], status, children, style }: TicketProps) {
  const s = useStyles();
  return (
    <View style={[s.ticket, style]}>
      <View style={s.top}>
        <View style={s.topHeader}>
          <View>
            <Text variant="label">{formatDay(departureTime)}</Text>
            <Text style={s.time}>{kigaliTime(departureTime)}</Text>
          </View>
          {status}
        </View>

        <View style={s.route}>
          <View style={s.routeRail}>
            <View style={[s.routeDot, s.routeDotBoard]} />
            <View style={s.routeLine} />
            <View style={[s.routeDot, s.routeDotAlight]} />
          </View>
          <View style={s.routeTexts}>
            <View>
              <Text variant="h3">{from}</Text>
              {fromLandmark ? <Text variant="caption">{fromLandmark}</Text> : null}
            </View>
            <View>
              <Text variant="h3">{to}</Text>
              {toLandmark ? <Text variant="caption">{toLandmark}</Text> : null}
            </View>
          </View>
        </View>

        <View style={s.codeBox}>
          <View style={s.codeLabelRow}>
            <Icon name="ticket" size={14} color="primary" />
            <Text variant="label" color="primary">
              Trip code
            </Text>
          </View>
          <Text style={s.code} selectable>
            {tripCode}
          </Text>
          <Text variant="caption" align="center">
            Show this to your driver when you board
          </Text>
        </View>
      </View>

      <View style={s.perforation}>
        <View style={[s.notch, s.notchLeft]} />
        <View style={s.dashes}>
          {Array.from({ length: 22 }, (_, i) => (
            <View key={i} style={s.dash} />
          ))}
        </View>
        <View style={[s.notch, s.notchRight]} />
      </View>

      <View style={s.bottom}>
        {stats.length ? (
          <View style={s.stats}>
            {stats.map((st) => (
              <StatChip key={st.label} {...st} style={s.stat} />
            ))}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  ticket: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, ...t.shadows.md },
  top: { padding: 20, gap: 18 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  time: { fontFamily: t.fonts.headingHeavy, fontSize: 30, lineHeight: 36, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  route: { flexDirection: 'row', gap: 12 },
  routeRail: { width: 16, alignItems: 'center', paddingVertical: 5 },
  routeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  routeDotBoard: { backgroundColor: t.colors.primary, borderColor: t.colors.tint },
  routeDotAlight: { backgroundColor: t.colors.accent, borderColor: t.colors.accent2 },
  routeLine: { flex: 1, width: 3, borderRadius: 2, backgroundColor: t.colors.primary, marginVertical: 2 },
  routeTexts: { flex: 1, gap: 14 },
  codeBox: { backgroundColor: t.colors.tint, borderRadius: t.radius.md, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', gap: 2 },
  codeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: { fontFamily: t.fonts.headingHeavy, fontSize: 40, lineHeight: 48, letterSpacing: 6, color: t.colors.ink },
  perforation: { height: NOTCH * 2, flexDirection: 'row', alignItems: 'center' },
  notch: { width: NOTCH * 2, height: NOTCH * 2, borderRadius: NOTCH, backgroundColor: t.colors.bg, position: 'absolute' },
  notchLeft: { left: -NOTCH },
  notchRight: { right: -NOTCH },
  dashes: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: NOTCH + 8, overflow: 'hidden' },
  dash: { width: 6, height: 2, borderRadius: 1, backgroundColor: t.colors.line },
  bottom: { padding: 20, paddingTop: 8, gap: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '30%' },
}));
