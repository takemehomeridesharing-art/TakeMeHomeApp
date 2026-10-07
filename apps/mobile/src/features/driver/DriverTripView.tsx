import { type TripDetail } from '@tmh/shared';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Card, Icon, Screen, Text } from '@/components';
import { routeLabel } from '@/lib/format';
import { useTrip } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';
import { Column } from './Column';
import { LedgerCard } from './LedgerCard';
import { PassengerList, passengerRows } from './PassengerList';
import { RequestsList } from './RequestsList';
import { RouteCard } from './RouteCard';
import { Section } from './Section';
import { TripActions } from './TripActions';
import { TripHeroCard } from './TripHeroCard';
import { isActiveTrip } from './tripMeta';

/**
 * The driver's management view of one trip (rendered by `app/trip/[id].tsx` when
 * `trip.viewerRole === 'driver'`): status + start/complete/cancel, incoming requests with
 * Accept/Decline, passengers (paid / awaiting payment, no-show, rate), the ledger and the corridor.
 * Realtime events invalidate the trip query, so this re-renders as requests and payments arrive.
 */
export function DriverTripView({ trip }: { trip: TripDetail }) {
  const s = useStyles();
  const { colors } = useTheme();
  const query = useTrip(trip.id);
  const requests = trip.joinRequests ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const rows = passengerRows(trip);
  const toRate = (trip.passengers ?? []).filter((p) => p.status === 'completed' && !p.driverRated).length;
  const active = isActiveTrip(trip.status);

  return (
    <Screen
      header={{ title: 'Your trip', subtitle: routeLabel(trip.stops) }}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      testID="driver-trip-view"
    >
      <Column>
        <TripHeroCard trip={trip} eyebrow="You're driving" pendingCount={pendingCount} />

        {active ? (
          <View style={s.actions}>
            <TripActions trip={trip} />
          </View>
        ) : null}

        {trip.status === 'completed' && toRate > 0 ? (
          <Card variant="tinted" style={s.rateCard}>
            <Icon name="star" size={22} color="accent" />
            <View style={s.flex}>
              <Text variant="bodyStrong">Rate your {toRate === 1 ? 'passenger' : `${toRate} passengers`}</Text>
              <Text variant="caption">Ratings keep Take Me Home safe for everyone. Tap “Rate passenger” below.</Text>
            </View>
          </Card>
        ) : null}

        {trip.status === 'cancelled' ? (
          <Card variant="outlined" style={s.rateCard}>
            <Icon name="close-circle" size={22} color="coral" />
            <View style={s.flex}>
              <Text variant="bodyStrong">You cancelled this trip</Text>
              <Text variant="caption">Paid passengers were refunded in full and open requests were closed.</Text>
            </View>
          </Card>
        ) : null}

        {active && trip.status !== 'in_progress' ? (
          <Section title="Requests to join" count={pendingCount} countTone="accent">
            <RequestsList requests={requests} />
          </Section>
        ) : null}

        <Section title="Passengers" count={rows.length}>
          <Card padding={16} style={s.listCard}>
            <PassengerList trip={trip} emptyText={trip.status === 'completed' ? 'Nobody rode with you on this trip.' : undefined} />
          </Card>
        </Section>

        {trip.ledger ? (
          <Section title="Running cost">
            <LedgerCard ledger={trip.ledger} seatsOffered={trip.seatsOffered} />
          </Section>
        ) : null}

        <Section title="Route">
          <RouteCard trip={trip} />
        </Section>

        <View style={s.footerLinks}>
          <Text variant="caption" color="primary" style={s.link} onPress={() => router.push('/history')}>
            See past trips
          </Text>
        </View>
      </Column>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  actions: { marginTop: 16 },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  flex: { flex: 1, gap: 2 },
  listCard: { paddingVertical: 4 },
  footerLinks: { alignItems: 'center', marginTop: 24 },
  link: { fontFamily: t.fonts.bodySemiBold },
}));
