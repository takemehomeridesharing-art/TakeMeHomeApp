import { formatKm, formatRwf, type Booking, type BookingStatus } from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, Share, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Button, Card, ErrorState, Icon, ListRow, LoadingState, Screen, StopList, Text, Ticket, toast, type BadgeKind } from '@/components';
import { CarVisual } from '@/features/passenger/CarVisual';
import { DriverRow } from '@/features/passenger/DriverRow';
import { firstName } from '@/features/passenger/labels';
import { SectionTitle } from '@/features/passenger/SectionTitle';
import { formatDeparture, formatPhone } from '@/lib/format';
import { useBooking } from '@/lib/queries';
import { makeStyles } from '@/theme';

const STATUS: Record<BookingStatus, { label: string; kind: BadgeKind }> = {
  confirmed: { label: 'Confirmed', kind: 'success' },
  completed: { label: 'Completed', kind: 'primary' },
  no_show: { label: 'No-show', kind: 'neutral' },
  refunded: { label: 'Refunded', kind: 'warning' },
};

/** The ticket: trip code, segment, stats, counterpart + car, stops, safety actions. Works for both sides. */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useBooking(id);

  if (q.isPending) {
    return (
      <Screen header={{ title: 'Ticket' }} scroll={false}>
        <LoadingState label="Loading your ticket…" />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen header={{ title: 'Ticket' }} scroll={false}>
        <ErrorState error={q.error} title="Couldn't load this ticket" onRetry={() => void q.refetch()} />
      </Screen>
    );
  }
  return <TicketView booking={q.data} />;
}

function shareMessage(b: Booking): string {
  const v = b.trip.vehicle;
  return [
    `I'm riding with Take Me Home — ticket ${b.tripCode}.`,
    `Route: ${b.boardStop.place.name} → ${b.alightStop.place.name} (${b.boardStop.place.landmark} → ${b.alightStop.place.landmark})`,
    `Departure: ${formatDeparture(b.trip.departureTime)}`,
    `Driver: ${b.driver.name}`,
    `Car: ${v.color} ${v.make} ${v.model} · plate ${v.plate}`,
  ].join('\n');
}

function TicketView({ booking: b }: { booking: Booking }) {
  const s = useStyles();
  const asPassenger = b.viewerRole === 'passenger';
  const other = asPassenger ? b.driver : b.passenger;
  const otherFirst = firstName(other.name);
  const status = STATUS[b.status];
  const tripStatus = b.trip.status;
  const canRate = b.status === 'completed' && !b.myRating;
  const live = b.status === 'confirmed' && (tripStatus === 'published' || tripStatus === 'full' || tripStatus === 'in_progress');
  const contact = b.trustedContactPhone;

  const share = async () => {
    const message = shareMessage(b);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
        if (contact) await Linking.openURL(`sms:${contact}?body=${encodeURIComponent(message)}`);
        else toast.show({ title: 'Sharing needs a phone', message: 'Open the app on your phone to share your ride.' });
        return;
      }
      await Share.share({ message, title: `Take Me Home · ${b.tripCode}` });
    } catch {
      toast.error("Couldn't open sharing", 'Try again in a moment.');
    }
    if (!contact) {
      toast.show({ title: 'Add a trusted contact', message: 'We’ll alert them automatically if you ever press SOS.', icon: 'shield-checkmark', onPress: () => router.navigate('/profile'), duration: 6000 });
    }
  };

  return (
    <Screen header={{ title: asPassenger ? 'Your ticket' : 'Passenger ticket', subtitle: b.tripCode }}>
      {canRate ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={s.rateCard}>
            <View style={s.rateIcon}>
              <Icon name="star" size={22} color="accent" />
            </View>
            <View style={s.flex}>
              <Text variant="h3">How was your ride with {otherFirst}?</Text>
              <Text variant="caption">Ratings keep Take Me Home safe and friendly.</Text>
            </View>
            <Button label="Rate" size="sm" onPress={() => router.push({ pathname: '/rate/[bookingId]', params: { bookingId: b.id } })} testID="rate-trip" />
          </Card>
        </Animated.View>
      ) : null}

      {tripStatus === 'in_progress' && b.status === 'confirmed' ? (
        <Card variant="tinted" style={s.banner} onPress={() => router.push({ pathname: '/track/[bookingId]', params: { bookingId: b.id } })}>
          <View style={s.liveDot} />
          <Text variant="bodyStrong" color="primary" style={s.flex}>
            On the way — follow your trip
          </Text>
          <Icon name="chevron-forward" size={18} color="primary" />
        </Card>
      ) : null}

      <Animated.View entering={FadeInDown.delay(60).duration(320)}>
        <Ticket
          from={b.boardStop.place.name}
          to={b.alightStop.place.name}
          fromLandmark={b.boardStop.place.landmark}
          toLandmark={b.alightStop.place.landmark}
          departureTime={b.trip.departureTime}
          tripCode={b.tripCode}
          status={<Badge kind={status.kind} label={status.label} icon={b.status === 'confirmed' ? 'checkmark-circle' : undefined} />}
          stats={[
            { label: 'Seat', value: '1 seat', icon: 'person-outline', tone: 'primary' },
            { label: 'Distance', value: formatKm(b.segmentKm), icon: 'navigate-outline' },
            { label: b.status === 'refunded' ? 'Refunded' : 'Paid', value: formatRwf(b.total), icon: 'wallet-outline', tone: 'accent' },
          ]}
          style={s.ticket}
        >
          <View style={s.divider} />
          <DriverRow user={other} caption={asPassenger ? 'Your driver' : 'Your passenger'} />
          <View style={s.carRow}>
            <View style={s.carBox}>
              <CarVisual vehicle={b.trip.vehicle} width={96} height={44} />
            </View>
            <View style={s.flex}>
              <Text variant="bodyStrong">
                {b.trip.vehicle.color} {b.trip.vehicle.make} {b.trip.vehicle.model}
              </Text>
              <Text variant="caption">{b.trip.isEV ? 'Electric · ' : ''}Look for this plate</Text>
            </View>
            <View style={s.plate}>
              <Text style={s.plateText}>{b.trip.vehicle.plate}</Text>
            </View>
          </View>
        </Ticket>
      </Animated.View>

      <View style={s.quick}>
        <Button
          label={`Message ${otherFirst}`}
          icon="chatbubble-ellipses-outline"
          variant="secondary"
          style={s.flex}
          onPress={() => router.push({ pathname: '/chat/[bookingId]', params: { bookingId: b.id } })}
          testID="message-driver"
        />
        <Button label="Track trip" icon="navigate" style={s.flex} onPress={() => router.push({ pathname: '/track/[bookingId]', params: { bookingId: b.id } })} testID="track-trip" />
      </View>

      {asPassenger ? (
        <Card variant="tinted" style={s.guarantee}>
          <View style={s.guaranteeIcon}>
            <Icon name="shield-checkmark" size={20} color="onPrimary" />
          </View>
          <View style={s.flex}>
            <Text variant="h3" color="primary2">
              Guaranteed Ride Home
            </Text>
            <Text variant="caption" color="ink">
              If your driver cancels, you get a full refund and we&apos;ll help you find another ride home.
            </Text>
          </View>
        </Card>
      ) : null}

      <Card padding={8} style={s.actions}>
        <View style={s.actionsInner}>
          {asPassenger && live ? (
            <ListRow
              icon="share-social"
              title={contact ? 'Share with your trusted contact' : 'Share your ride'}
              subtitle={contact ? `Send ${formatPhone(contact)} your trip details` : 'No trusted contact yet — add one in Profile'}
              onPress={() => void share()}
              divider
            />
          ) : null}
          <ListRow icon="chatbubbles-outline" title={`Message ${otherFirst}`} subtitle="Chat stays in the app — no need to share numbers" onPress={() => router.push({ pathname: '/chat/[bookingId]', params: { bookingId: b.id } })} divider />
          {b.status === 'completed' && b.myRating ? (
            <ListRow icon="star" iconColor="accentInk" title="You rated this trip" subtitle={`${b.myRating.stars} star${b.myRating.stars === 1 ? '' : 's'}${b.counterpartRated ? ` · ${otherFirst} rated you too` : ''}`} divider />
          ) : null}
          <ListRow
            icon="flag"
            iconColor="coral"
            title="Report an issue"
            subtitle="Safety, behaviour, or the car didn't match"
            onPress={() => router.push({ pathname: '/report', params: { bookingId: b.id, userId: other.id } })}
          />
        </View>
      </Card>

      <SectionTitle title="The route" style={s.section} />
      <Card style={s.stops}>
        <StopList stops={b.trip.stops} boardStopId={b.boardStop.id} alightStopId={b.alightStop.id} />
      </Card>

      <Text variant="caption" align="center" style={s.fine}>
        {formatRwf(b.contributionAmount)} cost share + {formatRwf(b.bookingFee)} booking fee · paid with MTN MoMo {formatPhone(b.payment.msisdn)}
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  rateCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, borderWidth: 1, borderColor: t.colors.accent },
  rateIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accent2, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.success },
  ticket: { marginTop: 4, marginBottom: 16 },
  divider: { height: 1, backgroundColor: t.colors.line },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carBox: { width: 104, height: 54, borderRadius: t.radius.sm, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  plate: { borderWidth: 2, borderColor: t.colors.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { fontFamily: t.fonts.headingHeavy, fontSize: 13, letterSpacing: 1, color: t.colors.ink },
  quick: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  guarantee: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  guaranteeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  actions: { marginBottom: 20 },
  actionsInner: { paddingHorizontal: 8 },
  section: { marginTop: 4 },
  stops: { marginBottom: 14 },
  fine: { marginTop: 4 },
}));
