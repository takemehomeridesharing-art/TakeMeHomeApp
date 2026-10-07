import { formatRwf, kigaliTime, type TripSummary } from '@tmh/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, ListRow, LoadingState, Text } from '@/components';
import { formatDay } from '@/lib/format';
import { useDriverDashboard } from '@/lib/queries';
import { makeStyles } from '@/theme';
import { recurringLabel, TRIP_STATUS_META } from './tripMeta';

/**
 * Driver-mode content of the Trips tab (rendered inside the tab's `Screen`): upcoming published
 * trips and a link to the history of completed/cancelled ones.
 */
export function DriverTripsList() {
  const s = useStyles();
  const dash = useDriverDashboard();

  if (dash.isPending) return <LoadingState label="Loading your trips…" fill={false} />;
  if (dash.isError) return <ErrorState error={dash.error} title="Couldn't load your trips" onRetry={() => void dash.refetch()} fill={false} />;

  const trips = dash.data.upcomingTrips;

  return (
    <View style={s.wrap} testID="driver-trips-list">
      <Text variant="label">Upcoming · {trips.length}</Text>
      {trips.length === 0 ? (
        <EmptyState
          icon="car-sport"
          title={dash.data.hasVehicle ? 'No upcoming trips' : 'Add your car first'}
          body={
            dash.data.hasVehicle
              ? "Publish the trip you're already making and share the running cost with people going your way."
              : 'Register the car you drive, then publish the trips you already make.'
          }
          action={
            dash.data.hasVehicle
              ? { label: 'Publish a trip', icon: 'add-circle', onPress: () => router.navigate('/publish') }
              : { label: 'Add your car', icon: 'car-sport', onPress: () => router.push('/vehicle/new') }
          }
        />
      ) : (
        <View style={s.list}>
          {trips.map((t, i) => (
            <Animated.View key={t.id} entering={FadeInDown.delay(i * 40).duration(260)}>
              <DriverTripRow trip={t} />
            </Animated.View>
          ))}
          <Button label="Publish another trip" variant="secondary" icon="add" block onPress={() => router.navigate('/publish')} />
        </View>
      )}

      <Card padding={8} style={s.historyCard}>
        <View style={s.historyInner}>
          <ListRow icon="time" title="Trip history" subtitle="Completed and cancelled trips, with what was recovered" onPress={() => router.push('/history')} />
        </View>
      </Card>
    </View>
  );
}

/** Compact card for one of the driver's trips. */
export function DriverTripRow({ trip }: { trip: TripSummary }) {
  const s = useStyles();
  const status = TRIP_STATUS_META[trip.status];
  const repeat = recurringLabel(trip.recurringDays);
  const from = trip.stops[0]?.place.name;
  const to = trip.stops[trip.stops.length - 1]?.place.name;
  const taken = trip.seatsOffered - trip.seatsLeft;
  return (
    <Card onPress={() => router.push(`/trip/${trip.id}`)} style={s.row} testID={`driver-trip-${trip.id}`}>
      <View style={s.timeCol}>
        <Text style={s.time}>{kigaliTime(trip.departureTime)}</Text>
        <Text variant="caption" numberOfLines={1}>
          {formatDay(trip.departureTime)}
        </Text>
      </View>
      <View style={s.mid}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {from} → {to}
        </Text>
        <View style={s.metaRow}>
          <Icon name="people" size={13} color="ink2" />
          <Text variant="caption">
            {taken}/{trip.seatsOffered} seats · {formatRwf(trip.fullRouteContribution.costShare)}/seat
          </Text>
        </View>
        <View style={s.badges}>
          <Badge kind={status.kind} label={status.label} icon={status.icon} />
          {trip.womenOnly ? <Badge kind="womenOnly" /> : null}
          {trip.isEV ? <Badge kind="ev" /> : null}
          {repeat ? <Badge kind="neutral" icon="repeat" label={repeat} /> : null}
        </View>
      </View>
      <Icon name="chevron-forward" size={18} color="ink3" />
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 12 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  timeCol: { width: 64, alignItems: 'flex-start', gap: 0 },
  time: { fontFamily: t.fonts.headingHeavy, fontSize: 20, lineHeight: 26, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  mid: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  historyCard: { marginTop: 8 },
  historyInner: { paddingHorizontal: 8 },
}));
