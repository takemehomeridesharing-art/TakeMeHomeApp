import { formatRwf, kigaliTime, type Booking, type PassengerRequestItem } from '@tmh/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, ListRow, LoadingState, Screen, Text } from '@/components';
import { DriverTripsList } from '@/features/driver/DriverTripsList';
import { CarVisual } from '@/features/passenger/CarVisual';
import { firstName, REQUEST_STATUS } from '@/features/passenger/labels';
import { SectionTitle } from '@/features/passenger/SectionTitle';
import { formatDay } from '@/lib/format';
import { useMyBookings, useMyRequests } from '@/lib/queries';
import { useSession } from '@/stores/session';
import { makeStyles } from '@/theme';

/** Trips tab — passenger: upcoming tickets, open requests, link to history. Driver: the driver's trip list. */
export default function TripsTab() {
  const s = useStyles();
  const mode = useSession((st) => st.mode);
  if (mode === 'driver') {
    return (
      <Screen tabBarSpace>
        <View style={s.intro}>
          <Text variant="h1">Your trips</Text>
          <Text variant="body" color="ink2">
            Trips you&apos;ve published and who&apos;s riding.
          </Text>
        </View>
        <DriverTripsList />
      </Screen>
    );
  }
  return <PassengerTrips />;
}

function PassengerTrips() {
  const s = useStyles();
  const bookings = useMyBookings();
  const requests = useMyRequests();

  const upcoming = useMemo(
    () =>
      (bookings.data ?? [])
        .filter((b) => b.viewerRole === 'passenger' && b.status === 'confirmed')
        .sort((a, b) => Date.parse(a.trip.departureTime) - Date.parse(b.trip.departureTime)),
    [bookings.data],
  );
  const toRate = useMemo(() => (bookings.data ?? []).filter((b) => b.viewerRole === 'passenger' && b.status === 'completed' && !b.myRating), [bookings.data]);
  const open = useMemo(
    () =>
      (requests.data ?? [])
        .filter((r) => !r.joinRequest.bookingId && (r.joinRequest.status === 'pending' || r.joinRequest.status === 'accepted'))
        .sort((a, b) => Date.parse(a.trip.departureTime) - Date.parse(b.trip.departureTime)),
    [requests.data],
  );

  const loading = bookings.isPending || requests.isPending;
  const error = bookings.error ?? requests.error;
  const refetch = () => {
    void bookings.refetch();
    void requests.refetch();
  };
  const nothing = upcoming.length === 0 && open.length === 0 && toRate.length === 0;

  return (
    <Screen tabBarSpace refreshControl={<RefreshControl refreshing={bookings.isRefetching || requests.isRefetching} onRefresh={refetch} />}>
      <View style={s.intro}>
        <Text variant="h1">Your trips</Text>
        <Text variant="body" color="ink2">
          Tickets, requests and rides to rate.
        </Text>
      </View>

      {loading ? (
        <LoadingState fill={false} />
      ) : error ? (
        <ErrorState error={error} title="Couldn't load your trips" onRetry={refetch} fill={false} />
      ) : (
        <>
          {toRate.length > 0 ? (
            <View style={s.section}>
              {toRate.map((b) => (
                <Card key={b.id} style={s.rateCard} onPress={() => router.push({ pathname: '/rate/[bookingId]', params: { bookingId: b.id } })}>
                  <View style={s.rateIcon}>
                    <Icon name="star" size={20} color="accent" />
                  </View>
                  <View style={s.flex}>
                    <Text variant="bodyStrong">Rate your trip with {firstName(b.driver.name)}</Text>
                    <Text variant="caption">
                      {b.boardStop.place.name} → {b.alightStop.place.name} · {formatDay(b.trip.departureTime)}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color="ink3" />
                </Card>
              ))}
            </View>
          ) : null}

          <View style={s.section}>
            <SectionTitle title="Upcoming" right={upcoming.length ? <Badge kind="success" label={`${upcoming.length}`} /> : null} />
            {upcoming.length === 0 ? (
              <Card variant="outlined" style={s.emptyCard}>
                <Text variant="caption">No confirmed seats yet. Once a driver accepts and you pay, your ticket lands here.</Text>
              </Card>
            ) : (
              upcoming.map((b, i) => <UpcomingCard key={b.id} booking={b} index={i} />)
            )}
          </View>

          <View style={s.section}>
            <SectionTitle title="Requests" right={open.length ? <Badge kind="warning" label={`${open.length}`} /> : null} />
            {open.length === 0 ? (
              <Card variant="outlined" style={s.emptyCard}>
                <Text variant="caption">No open requests. Find a trip going your way and request to join.</Text>
              </Card>
            ) : (
              open.map((r, i) => <RequestCard key={r.joinRequest.id} item={r} index={i} />)
            )}
          </View>

          {nothing ? (
            <EmptyState icon="car-sport-outline" title="Going somewhere?" body="Find a seat on a trip someone is already making." action={{ label: 'Find a ride', icon: 'search', onPress: () => router.navigate('/rides') }} />
          ) : null}

          <SectionTitle title="Past" />
          <Card padding={8}>
            <View style={s.rowPad}>
              <ListRow icon="time" title="Trip history" subtitle="Rides you've taken and what you paid" onPress={() => router.push('/history')} />
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function UpcomingCard({ booking: b, index }: { booking: Booking; index: number }) {
  const s = useStyles();
  const live = b.trip.status === 'in_progress';
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(260)}>
      <Card padding={0} style={s.card} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })} testID={`upcoming-${index}`}>
        <View style={s.cardTop}>
          <View style={s.timeCol}>
            <Text variant="label">{formatDay(b.trip.departureTime)}</Text>
            <Text style={s.time}>{kigaliTime(b.trip.departureTime)}</Text>
          </View>
          <View style={s.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {b.boardStop.place.name} → {b.alightStop.place.name}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {firstName(b.driver.name)} · {b.trip.vehicle.color} {b.trip.vehicle.make} · {b.trip.vehicle.plate}
            </Text>
          </View>
          <View style={s.carBox}>
            <CarVisual vehicle={b.trip.vehicle} width={70} height={32} />
          </View>
        </View>
        <View style={s.cardBottom}>
          <View style={s.code}>
            <Icon name="ticket" size={14} color="primary" />
            <Text style={s.codeText}>{b.tripCode}</Text>
          </View>
          {live ? <Badge kind="success" icon="navigate" label="On the way" /> : <Badge kind="success" icon="checkmark-circle" label="Confirmed" />}
          <View style={s.flex} />
          {live ? (
            <Button label="Track" size="sm" icon="navigate" onPress={() => router.push({ pathname: '/track/[bookingId]', params: { bookingId: b.id } })} />
          ) : (
            <Text style={s.paid}>{formatRwf(b.total)}</Text>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

function RequestCard({ item, index }: { item: PassengerRequestItem; index: number }) {
  const s = useStyles();
  const { joinRequest: jr, trip } = item;
  const accepted = jr.status === 'accepted';
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(260)}>
      <Card style={[s.card, s.requestCard, accepted ? s.acceptedCard : null]} onPress={() => router.push({ pathname: '/request/[id]', params: { id: jr.id } })} testID={`request-${index}`}>
        <View style={s.flex}>
          <Badge kind={REQUEST_STATUS[jr.status].badge} label={accepted ? 'Accepted — pay to confirm' : `Waiting for ${firstName(trip.driver.name)}`} icon={accepted ? 'checkmark-circle' : 'time'} />
          <Text variant="bodyStrong" style={s.requestRoute} numberOfLines={1}>
            {jr.boardStop.place.name} → {jr.alightStop.place.name}
          </Text>
          <Text variant="caption">
            {formatDay(trip.departureTime)} · {kigaliTime(trip.departureTime)} · {formatRwf(jr.total)}
          </Text>
        </View>
        {accepted ? (
          <Button label="Pay" size="sm" icon="phone-portrait-outline" onPress={() => router.push({ pathname: '/pay/[requestId]', params: { requestId: jr.id } })} />
        ) : (
          <Icon name="chevron-forward" size={18} color="ink3" />
        )}
      </Card>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  intro: { marginTop: 12, marginBottom: 18, gap: 2 },
  section: { marginBottom: 22 },
  emptyCard: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  card: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  timeCol: { minWidth: 64 },
  time: { fontFamily: t.fonts.headingHeavy, fontSize: 22, lineHeight: 26, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  carBox: { width: 76, height: 44, borderRadius: t.radius.sm, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.colors.line },
  code: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.colors.tint, borderRadius: t.radius.pill, paddingHorizontal: 10, height: 26 },
  codeText: { fontFamily: t.fonts.heading, fontSize: 13, letterSpacing: 1, color: t.colors.primary },
  paid: { fontFamily: t.fonts.heading, fontSize: 15, color: t.colors.accentInk },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  acceptedCard: { borderWidth: 1.5, borderColor: t.colors.primary },
  requestRoute: { marginTop: 6 },
  rateCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderWidth: 1, borderColor: t.colors.accent },
  rateIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.accent2, alignItems: 'center', justifyContent: 'center' },
  rowPad: { paddingHorizontal: 8 },
}));
