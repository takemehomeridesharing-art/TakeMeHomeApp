import { formatKm, formatRwf, type TripSummary } from '@tmh/shared';
import { View } from 'react-native';
import { Badge, CarIllustration, Card, Icon, StatChip, Text } from '@/components';
import { formatDeparture } from '@/lib/format';
import { makeStyles } from '@/theme';
import { recurringLabel, TRIP_STATUS_META } from './tripMeta';

export interface TripHeroCardProps {
  trip: TripSummary;
  /** Small caps label above the route, e.g. "Next trip". */
  eyebrow?: string;
  onPress?: () => void;
  /** Pending requests, shown as an amber pill. */
  pendingCount?: number;
  testID?: string;
}

/** The driver's trip at a glance: status, route with landmarks, departure, seats, badges and the car. */
export function TripHeroCard({ trip, eyebrow, onPress, pendingCount = 0, testID }: TripHeroCardProps) {
  const s = useStyles();
  const origin = trip.stops[0];
  const dest = trip.stops[trip.stops.length - 1];
  const via = trip.stops.slice(1, -1);
  const status = TRIP_STATUS_META[trip.status];
  const repeat = recurringLabel(trip.recurringDays);
  const taken = trip.seatsOffered - trip.seatsLeft;

  return (
    <Card onPress={onPress} padding={0} style={s.card} testID={testID}>
      <View style={s.top}>
        <View style={s.topRow}>
          <Text variant="label" color="primary">
            {eyebrow ?? 'Your trip'}
          </Text>
          <Badge kind={status.kind} label={status.label} icon={status.icon} />
        </View>

        <Text style={s.when}>{formatDeparture(trip.departureTime)}</Text>

        <View style={s.route}>
          <View style={s.rail}>
            <View style={s.dotFrom} />
            <View style={s.railLine} />
            <View style={s.dotTo} />
          </View>
          <View style={s.routeTexts}>
            <View>
              <Text variant="h3" numberOfLines={1}>
                {origin?.place.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {origin?.place.landmark}
              </Text>
            </View>
            {via.length ? (
              <Text variant="caption" color="ink3" numberOfLines={1}>
                via {via.map((v) => v.place.name).join(' · ')}
              </Text>
            ) : null}
            <View>
              <Text variant="h3" numberOfLines={1}>
                {dest?.place.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {dest?.place.landmark}
              </Text>
            </View>
          </View>
          <View style={s.car}>
            <CarIllustration color={trip.vehicle.color} width={112} shadow={false} />
            <Text variant="caption" color="ink2" numberOfLines={1} align="center">
              {trip.vehicle.plate}
            </Text>
          </View>
        </View>

        <View style={s.badges}>
          {trip.womenOnly ? <Badge kind="womenOnly" /> : null}
          {trip.isEV ? <Badge kind="ev" label="EV · RWF 100 fee" /> : null}
          {repeat ? <Badge kind="neutral" icon="repeat" label={repeat} /> : null}
          {pendingCount > 0 ? <Badge kind="warning" icon="hand-right" label={`${pendingCount} waiting`} /> : null}
        </View>
      </View>

      <View style={s.stats}>
        <StatChip label="Seats" value={`${taken} of ${trip.seatsOffered}`} icon="people" tone="primary" style={s.stat} />
        <StatChip label="Distance" value={formatKm(trip.totalKm)} icon="navigate" style={s.stat} />
        <StatChip label="Per seat" value={formatRwf(trip.fullRouteContribution.costShare)} icon="pie-chart" tone="accent" style={s.stat} />
      </View>
      {onPress ? (
        <View style={s.footer}>
          <Text variant="caption" color="primary" style={s.footerText}>
            Manage this trip
          </Text>
          <Icon name="chevron-forward" size={16} color="primary" />
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { overflow: 'hidden' },
  top: { padding: 18, gap: 12 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  when: {
    fontFamily: t.fonts.headingHeavy,
    fontSize: 24,
    lineHeight: 30,
    color: t.colors.ink,
    letterSpacing: -0.3,
  },
  route: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  rail: { width: 14, alignItems: 'center', paddingVertical: 5 },
  dotFrom: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: t.colors.primary,
    borderWidth: 3,
    borderColor: t.colors.tint,
  },
  dotTo: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: t.colors.accent,
    borderWidth: 3,
    borderColor: t.colors.accent2,
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: t.colors.line,
    marginVertical: 3,
  },
  routeTexts: { flex: 1, gap: 6, justifyContent: 'space-between' },
  car: { width: 112, alignItems: 'center', justifyContent: 'center', gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stats: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  stat: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
    backgroundColor: t.colors.bg,
  },
  footerText: { fontFamily: t.fonts.bodySemiBold },
}));
