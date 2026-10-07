import { formatRwf, type PassengerRequestItem } from '@tmh/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Badge, Button, Card, ErrorState, FareBreakdownCard, Icon, LoadingState, Screen, StopList, Text, toast } from '@/components';
import { CarVisual } from '@/features/passenger/CarVisual';
import { ConfirmSheet } from '@/features/passenger/ConfirmSheet';
import { DriverRow } from '@/features/passenger/DriverRow';
import { ErrorCard } from '@/features/passenger/ErrorCard';
import { hapticSuccess, hapticWarning } from '@/features/passenger/haptics';
import { firstName, REQUEST_STATUS } from '@/features/passenger/labels';
import { PulseRings } from '@/features/passenger/PulseRings';
import { formatDeparture } from '@/lib/format';
import { qk, useCancelRequest, useJoinRequest } from '@/lib/queries';
import { useSocketEvent } from '@/lib/socket';
import { makeStyles } from '@/theme';

/** A passenger's join request: realtime status (pending → accepted → paid), segment and contribution. */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const q = useJoinRequest(id);

  // Apply driver decisions instantly (the RealtimeBridge also invalidates the query).
  useSocketEvent('join_request:updated', (jr) => {
    if (jr.id !== id) return;
    client.setQueryData<PassengerRequestItem>(qk.requests.detail(id), (prev) => (prev ? { ...prev, joinRequest: jr } : prev));
  });

  if (q.isPending) {
    return (
      <Screen header={{ title: 'Your request' }} scroll={false}>
        <LoadingState label="Loading your request…" />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen header={{ title: 'Your request' }} scroll={false}>
        <ErrorState error={q.error} title="Couldn't load this request" onRetry={() => void q.refetch()} />
      </Screen>
    );
  }
  return <RequestView item={q.data} />;
}

function RequestView({ item }: { item: PassengerRequestItem }) {
  const s = useStyles();
  const { joinRequest: jr, trip } = item;
  const cancel = useCancelRequest();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const driver = firstName(trip.driver.name);
  const paying = jr.latestPayment?.status === 'initiated';
  const booked = Boolean(jr.bookingId);
  const canCancel = !booked && !paying && (jr.status === 'pending' || jr.status === 'accepted');

  // Celebrate the flip to accepted / declined while the screen is open.
  const prev = useRef(jr.status);
  useEffect(() => {
    if (prev.current !== jr.status) {
      if (jr.status === 'accepted') hapticSuccess();
      else if (jr.status === 'declined') hapticWarning();
      prev.current = jr.status;
    }
  }, [jr.status]);

  const findAnother = () =>
    router.navigate({ pathname: '/rides', params: { from: jr.boardStop.placeId, to: jr.alightStop.placeId, when: 'week' } });

  const doCancel = () =>
    cancel.mutate(jr.id, {
      onSuccess: () => {
        setConfirmCancel(false);
        toast.show({ title: 'Request cancelled', message: `${driver} has been told you won't need the seat.` });
      },
    });

  const footer = booked ? (
    <Button label="View your ticket" icon="ticket" size="lg" block onPress={() => router.replace({ pathname: '/booking/[id]', params: { id: jr.bookingId! } })} testID="view-ticket" />
  ) : jr.status === 'accepted' ? (
    <>
      <Button
        label={paying ? 'Continue payment' : `Pay ${formatRwf(jr.total)} with MoMo`}
        icon="phone-portrait-outline"
        size="lg"
        block
        onPress={() => router.push({ pathname: '/pay/[requestId]', params: { requestId: jr.id } })}
        testID="pay-momo"
      />
      {canCancel ? <Button label="Cancel request" variant="ghost" block onPress={() => setConfirmCancel(true)} testID="cancel-request" /> : null}
    </>
  ) : jr.status === 'pending' ? (
    <Button label="Cancel request" variant="secondary" size="lg" block onPress={() => setConfirmCancel(true)} testID="cancel-request" />
  ) : (
    <Button label="Find another ride" icon="search" size="lg" block onPress={findAnother} testID="find-another" />
  );

  return (
    <Screen header={{ title: 'Your request', subtitle: `${jr.boardStop.place.name} → ${jr.alightStop.place.name}` }} footer={footer}>
      <Animated.View key={booked ? 'booked' : jr.status} entering={FadeIn.duration(300)} style={s.hero} testID={`request-status-${booked ? 'booked' : jr.status}`}>
        <StatusHero item={item} />
      </Animated.View>

      {cancel.error ? <ErrorCard error={cancel.error} fallbackTitle="Couldn't cancel" style={s.block} /> : null}

      <Animated.View entering={FadeInDown.delay(120).duration(300)}>
        <Card style={s.card} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}>
          <View style={s.tripTop}>
            <View style={s.flex}>
              <Text variant="label">{formatDeparture(trip.departureTime)}</Text>
              <Text variant="h3" style={s.tripRoute}>
                {trip.stops[0]!.place.name} → {trip.stops[trip.stops.length - 1]!.place.name}
              </Text>
              <Text variant="caption">
                {trip.vehicle.make} {trip.vehicle.model} · {trip.vehicle.color} · {trip.vehicle.plate}
              </Text>
            </View>
            <View style={s.carBox}>
              <CarVisual vehicle={trip.vehicle} width={84} height={40} />
            </View>
          </View>
          <View style={s.divider} />
          <DriverRow user={trip.driver} right={<Icon name="chevron-forward" size={18} color="ink3" />} />
        </Card>

        <Card style={s.card}>
          <Text variant="h3">Your stops</Text>
          <StopList stops={trip.stops} boardStopId={jr.boardStop.id} alightStopId={jr.alightStop.id} compact />
        </Card>

        <FareBreakdownCard
          segmentKm={jr.segmentKm}
          seatsOffered={trip.seatsOffered}
          costShare={jr.contributionAmount}
          bookingFee={jr.bookingFee}
          total={jr.total}
          isEV={trip.isEV}
          title={booked ? 'You paid' : 'Your contribution'}
        />
      </Animated.View>

      <ConfirmSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this request?"
        subtitle={`${driver} will be told you no longer need the seat. You won't be charged.`}
        confirmLabel="Yes, cancel request"
        confirmVariant="danger"
        cancelLabel="Keep my request"
        loading={cancel.isPending}
        onConfirm={doCancel}
        testID="confirm-cancel"
      />
    </Screen>
  );
}

function StatusHero({ item }: { item: PassengerRequestItem }) {
  const s = useStyles();
  const { joinRequest: jr, trip } = item;
  const driver = firstName(trip.driver.name);

  if (jr.bookingId) {
    return (
      <>
        <Animated.View entering={ZoomIn.springify()}>
          <PulseRings icon="checkmark" tone="success" active={false} />
        </Animated.View>
        <Text variant="h1" align="center">
          Your seat is confirmed
        </Text>
        <Text variant="body" color="ink2" align="center" style={s.heroBody}>
          Paid {formatRwf(jr.total)}. Your ticket has the trip code to show {driver} when you board.
        </Text>
      </>
    );
  }

  switch (jr.status) {
    case 'pending':
      return (
        <>
          <PulseRings icon="hourglass-outline" tone="primary" />
          <Badge kind="warning" icon="time" label="Request sent" style={s.heroBadge} />
          <Text variant="h1" align="center">
            Waiting for {driver} to accept
          </Text>
          <Text variant="body" color="ink2" align="center" style={s.heroBody}>
            {driver} decides who rides along. We&apos;ll update this screen and notify you the moment {driver} answers.
          </Text>
        </>
      );
    case 'accepted': {
      const failed = jr.latestPayment?.status === 'failed' ? jr.latestPayment : null;
      return (
        <>
          <Animated.View entering={ZoomIn.springify()}>
            <PulseRings icon="checkmark" tone="success" active={false} />
          </Animated.View>
          <Badge kind="success" icon="checkmark-circle" label="Accepted" style={s.heroBadge} />
          <Text variant="h1" align="center">
            {driver} accepted your request!
          </Text>
          <Text variant="body" color="ink2" align="center" style={s.heroBody}>
            {jr.latestPayment?.status === 'initiated'
              ? 'Your MoMo payment is waiting for approval on your phone.'
              : `Pay your ${formatRwf(jr.total)} contribution with MTN MoMo to lock in your seat.`}
          </Text>
          {failed ? (
            <Text variant="caption" color="coral" align="center">
              Last payment didn&apos;t go through{failed.failureReason ? `: ${failed.failureReason}` : ''}. You can try again.
            </Text>
          ) : null}
        </>
      );
    }
    default: {
      const copy = {
        declined: { title: `${driver} can't take you this time`, body: 'It happens — plans change. Other drivers may be going your way.' },
        expired: { title: 'This request expired', body: 'The trip left before your seat was confirmed. You were not charged.' },
        cancelled: { title: 'You cancelled this request', body: "You weren't charged. Find another trip going your way." },
      }[jr.status];
      return (
        <>
          <PulseRings icon={jr.status === 'declined' ? 'close' : 'remove'} tone="primary" active={false} size={72} />
          <Badge kind={REQUEST_STATUS[jr.status].badge} label={REQUEST_STATUS[jr.status].label} style={s.heroBadge} />
          <Text variant="h1" align="center">
            {copy.title}
          </Text>
          <Text variant="body" color="ink2" align="center" style={s.heroBody}>
            {copy.body}
          </Text>
        </>
      );
    }
  }
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 22 },
  heroBadge: { alignSelf: 'center', marginTop: -6 },
  heroBody: { maxWidth: 320 },
  block: { marginBottom: 14 },
  card: { gap: 12, marginBottom: 14 },
  tripTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripRoute: { marginVertical: 2 },
  carBox: { width: 92, height: 52, borderRadius: t.radius.sm, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: t.colors.line },
}));
