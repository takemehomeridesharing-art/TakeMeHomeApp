import { formatKm, formatRwf, kigaliTime, type TripMatch, type TripSummary } from '@tmh/shared';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Badge, Card, Icon, Text } from '@/components';
import { formatDay } from '@/lib/format';
import { makeStyles } from '@/theme';
import { CarVisual } from './CarVisual';
import { DriverRow } from './DriverRow';

export interface TripCardProps {
  match: TripMatch;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const stopName = (trip: TripSummary, id: string) => trip.stops.find((s) => s.id === id)?.place.name ?? '';

/** Search result: car + driver, departure, corridor + the passenger's segment, badges, seats, segment price. */
export function TripCard({ match, onPress, style, testID }: TripCardProps) {
  const s = useStyles();
  const { trip } = match;
  const origin = trip.stops[0]?.place.name ?? '';
  const dest = trip.stops[trip.stops.length - 1]?.place.name ?? '';
  const seats = match.seatsAvailable;

  return (
    <Card onPress={onPress} padding={0} style={style} testID={testID} accessibilityLabel={`${trip.driver.name}, ${origin} to ${dest}, ${formatRwf(match.contribution.total)}`}>
      <View style={s.top}>
        <View style={s.carBox}>
          <CarVisual vehicle={trip.vehicle} width={92} height={46} />
        </View>
        <View style={s.driver}>
          <DriverRow user={trip.driver} hideAvatar />
          <Text variant="caption" numberOfLines={1}>
            {trip.vehicle.make} {trip.vehicle.model} · {trip.vehicle.color}
          </Text>
        </View>
      </View>

      <View style={s.body}>
        <View style={s.timeCol}>
          <Text style={s.time}>{kigaliTime(trip.departureTime)}</Text>
          <Text variant="caption">{formatDay(trip.departureTime)}</Text>
        </View>
        <View style={s.routeCol}>
          <View style={s.segmentRow}>
            <View style={[s.dot, s.dotBoard]} />
            <Text variant="bodyStrong" numberOfLines={1} style={s.flexShrink}>
              {stopName(trip, match.boardStopId)}
            </Text>
            <Icon name="arrow-forward" size={14} color="ink3" />
            <View style={[s.dot, s.dotAlight]} />
            <Text variant="bodyStrong" numberOfLines={1} style={s.flexShrink}>
              {stopName(trip, match.alightStopId)}
            </Text>
          </View>
          <Text variant="caption" numberOfLines={1}>
            {formatKm(match.segmentKm)} of the {origin} → {dest} route
          </Text>
        </View>
      </View>

      <View style={s.footer}>
        <View style={s.badges}>
          {trip.womenOnly ? <Badge kind="womenOnly" /> : null}
          {trip.isEV ? <Badge kind="ev" /> : null}
          <Badge kind={seats > 0 ? 'success' : 'neutral'} icon="person" label={seats > 0 ? `${seats} seat${seats === 1 ? '' : 's'} left` : 'Full'} />
        </View>
        <View style={s.priceCol}>
          <Text variant="caption" style={s.priceCaption}>
            your share
          </Text>
          <View style={s.pricePill}>
            <Text style={s.price} numberOfLines={1}>
              {formatRwf(match.contribution.total)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/** Compact card for horizontal rails (home): car, time, route, "from RWF x". */
export function TripMiniCard({ trip, onPress, testID }: { trip: TripSummary; onPress: () => void; testID?: string }) {
  const s = useStyles();
  const origin = trip.stops[0]?.place.name ?? '';
  const dest = trip.stops[trip.stops.length - 1]?.place.name ?? '';
  return (
    <Card onPress={onPress} padding={14} style={s.mini} testID={testID}>
      <View style={s.miniCar}>
        <CarVisual vehicle={trip.vehicle} width={150} height={62} />
        <View style={s.miniBadges}>
          {trip.womenOnly ? <Badge kind="womenOnly" label="Women" /> : null}
          {trip.isEV ? <Badge kind="ev" /> : null}
        </View>
      </View>
      <View style={s.miniTimeRow}>
        <Text style={s.miniTime}>{kigaliTime(trip.departureTime)}</Text>
        <Text variant="caption">{formatDay(trip.departureTime)}</Text>
      </View>
      <Text variant="bodyStrong" numberOfLines={1}>
        {origin} → {dest}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {trip.driver.name.split(' ')[0]} · {trip.seatsLeft} seat{trip.seatsLeft === 1 ? '' : 's'} left
      </Text>
      <Text style={s.miniPrice}>from {formatRwf(trip.fullRouteContribution.total)}</Text>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  carBox: { width: 92, height: 56, borderRadius: t.radius.sm, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  driver: { flex: 1, gap: 2 },
  priceCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pricePill: { backgroundColor: t.colors.accent2, borderRadius: t.radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  price: { fontFamily: t.fonts.headingHeavy, fontSize: 17, lineHeight: 21, color: t.colors.accentInk, fontVariant: ['tabular-nums'] },
  priceCaption: { fontSize: 11, lineHeight: 14 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.colors.line },
  timeCol: { alignItems: 'flex-start', minWidth: 58 },
  time: { fontFamily: t.fonts.headingHeavy, fontSize: 22, lineHeight: 26, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  routeCol: { flex: 1, gap: 2 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flexShrink: { flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  dotBoard: { backgroundColor: t.colors.primary, borderColor: t.colors.tint },
  dotAlight: { backgroundColor: t.colors.accent, borderColor: t.colors.accent2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  mini: { width: 200, gap: 4 },
  miniCar: { height: 74, borderRadius: t.radius.sm, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' },
  miniBadges: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', gap: 4 },
  miniTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  miniTime: { fontFamily: t.fonts.headingHeavy, fontSize: 20, lineHeight: 24, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  miniPrice: { fontFamily: t.fonts.heading, fontSize: 14, lineHeight: 20, color: t.colors.accentInk, marginTop: 2 },
}));
