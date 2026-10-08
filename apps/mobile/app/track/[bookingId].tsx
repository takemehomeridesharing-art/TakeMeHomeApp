import { kigaliTime, type Booking, type SosEvent } from '@tmh/shared';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Button, Card, ErrorState, HeaderIconButton, Icon, LoadingState, Screen, StopList, Text } from '@/components';
import { TripMap } from '@/components/TripMap';
import { ConfirmSheet } from '@/features/passenger/ConfirmSheet';
import { DriverRow } from '@/features/passenger/DriverRow';
import { ErrorCard } from '@/features/passenger/ErrorCard';
import { hapticSuccess, hapticWarning } from '@/features/passenger/haptics';
import { firstName } from '@/features/passenger/labels';
import { SosButton } from '@/features/passenger/SosButton';
import { formatDay, formatPhone } from '@/lib/format';
import { useBooking, useSos } from '@/lib/queries';
import { makeStyles } from '@/theme';

/** Current position if permission is (or can be) granted; never blocks SOS for long. Skipped on web. */
async function currentPosition(): Promise<{ lat: number; lng: number } | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return undefined;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : undefined;
  } catch {
    return undefined;
  }
}

/** Track a booked trip: corridor map, status, driver, chat and the SOS button. */
export default function TrackScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const q = useBooking(bookingId);

  if (q.isPending) {
    return (
      <Screen header={{ title: 'Track trip' }} scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen header={{ title: 'Track trip' }} scroll={false}>
        <ErrorState error={q.error} title="Couldn't load this trip" onRetry={() => void q.refetch()} />
      </Screen>
    );
  }
  return <TrackView booking={q.data} />;
}

function statusCopy(b: Booking): { title: string; body: string; live: boolean } {
  const t = b.trip;
  const day = formatDay(t.departureTime);
  switch (t.status) {
    case 'in_progress':
      return { title: 'On the way', body: `Heading to ${b.alightStop.place.name} · ${b.alightStop.place.landmark}`, live: true };
    case 'completed':
      return { title: 'Trip completed', body: `You arrived at ${b.alightStop.place.name}. Thanks for sharing the ride.`, live: false };
    case 'cancelled':
      return { title: 'Trip cancelled', body: 'Your contribution is refunded in full. We’ll help you find another ride home.', live: false };
    default:
      return {
        title: `Starts ${day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day} ${kigaliTime(t.departureTime)}`,
        body: `Be at ${b.boardStop.place.landmark} (${b.boardStop.place.name}) a few minutes early.`,
        live: false,
      };
  }
}

function TrackView({ booking: b }: { booking: Booking }) {
  const s = useStyles();
  const sos = useSos();
  const [confirm, setConfirm] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sent, setSent] = useState<SosEvent | null>(null);
  const asPassenger = b.viewerRole === 'passenger';
  const other = asPassenger ? b.driver : b.passenger;
  const status = statusCopy(b);
  const placeOf = (stopId: string) => b.trip.stops.find((x) => x.id === stopId)?.placeId;

  const sendSos = async () => {
    hapticWarning();
    setLocating(true);
    const pos = await currentPosition();
    setLocating(false);
    sos.mutate(
      { bookingId: b.id, ...pos },
      {
        onSuccess: (ev) => {
          hapticSuccess();
          setConfirm(false);
          setSent(ev);
        },
      },
    );
  };

  const chat = () => router.push({ pathname: '/chat/[bookingId]', params: { bookingId: b.id } });

  return (
    <Screen header={{ title: 'Track trip', subtitle: b.tripCode, right: <HeaderIconButton icon="ticket-outline" accessibilityLabel="Ticket" onPress={() => router.navigate({ pathname: '/booking/[id]', params: { id: b.id } })} /> }}>
      <TripMap
        routeStops={b.trip.stops.map((x) => x.place)}
        boardPlaceId={placeOf(b.boardStop.id)}
        alightPlaceId={placeOf(b.alightStop.id)}
        height={250}
        style={s.map}
      />

      <Card style={s.card}>
        <View style={s.statusRow}>
          <View style={[s.statusDot, status.live ? s.live : b.trip.status === 'cancelled' ? s.cancelled : null]} />
          <View style={s.flex}>
            <Text variant="h2">{status.title}</Text>
            <Text variant="caption">{status.body}</Text>
          </View>
        </View>
        <View style={s.divider} />
        <DriverRow
          user={other}
          caption={asPassenger ? `${b.trip.vehicle.color} ${b.trip.vehicle.make} ${b.trip.vehicle.model} · ${b.trip.vehicle.plate}` : 'Your passenger'}
          right={
            <View style={s.roundBtns}>
              {b.counterpartPhone ? (
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${b.counterpartPhone}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${firstName(other.name)}`}
                  style={({ pressed }) => [s.roundBtn, pressed ? s.pressed : null]}
                  testID="track-call"
                >
                  <Icon name="call" size={20} color="primary" />
                </Pressable>
              ) : null}
              <Pressable onPress={chat} accessibilityRole="button" accessibilityLabel={`Message ${firstName(other.name)}`} style={({ pressed }) => [s.roundBtn, pressed ? s.pressed : null]} testID="track-chat">
                <Icon name="chatbubble-ellipses" size={20} color="primary" />
              </Pressable>
            </View>
          }
        />
      </Card>

      <Card style={s.card}>
        <Text variant="h3">Your stops</Text>
        <StopList stops={b.trip.stops} boardStopId={b.boardStop.id} alightStopId={b.alightStop.id} compact kmFromBoard />
      </Card>

      {/* Safety */}
      {sent ? (
        <Animated.View entering={ZoomIn.springify()} style={s.sentCard} testID="sos-sent">
          <View style={s.sentHead}>
            <Icon name="checkmark-circle" size={22} color="coral" />
            <Text variant="h3">Alert sent</Text>
          </View>
          <Text variant="body" testID="sos-sent-detail">
            {sent.notifiedContacts && sent.contactPhone
              ? `Alert sent to ${formatPhone(sent.contactPhone)} · Safety team notified`
              : 'Safety team notified · No trusted contact set — add one in Profile'}
          </Text>
          {sent.lat != null ? <Text variant="caption">Your location was shared with the alert.</Text> : null}
          {!sent.notifiedContacts ? <Button label="Add a trusted contact" variant="ghost" size="sm" icon="person-add-outline" onPress={() => router.navigate('/profile')} style={s.addContact} /> : null}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(300)} style={s.sosWrap}>
          <SosButton onPress={() => setConfirm(true)} testID="sos-button" />
          <Text variant="caption" align="center" style={s.sosCaption}>
            Feeling unsafe? Tap SOS to alert your trusted contact and the Take Me Home safety team.
          </Text>
        </Animated.View>
      )}

      <Pressable onPress={() => void Linking.openURL('tel:112')} accessibilityRole="link" style={({ pressed }) => [s.emergency, pressed ? s.pressed : null]} testID="call-112">
        <Icon name="call" size={16} color="coral" />
        <Text variant="bodyStrong">If you are in danger call </Text>
        <Text variant="bodyStrong" color="coral">
          112
        </Text>
      </Pressable>

      <ConfirmSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title="Send an SOS alert?"
        subtitle="Alert your trusted contact and Take Me Home safety team?"
        confirmLabel="Send SOS alert"
        confirmIcon="alert-circle"
        confirmVariant="danger"
        cancelLabel="Cancel"
        loading={locating || sos.isPending}
        onConfirm={() => void sendSos()}
        testID="sos-confirm"
      >
        <View style={s.sheetList}>
          <SheetLine icon="ticket-outline" text={`Trip ${b.tripCode} · ${b.boardStop.place.name} → ${b.alightStop.place.name}`} />
          <SheetLine icon="car-outline" text={`${b.trip.vehicle.color} ${b.trip.vehicle.make} · ${b.trip.vehicle.plate} · ${b.driver.name}`} />
          <SheetLine icon="location-outline" text={Platform.OS === 'web' ? 'Your location (on your phone)' : 'Your current location, if allowed'} />
        </View>
        {sos.error ? <ErrorCard error={sos.error} fallbackTitle="Couldn't send the alert" /> : null}
        <Text variant="caption">If you are in immediate danger, call 112 first.</Text>
      </ConfirmSheet>
    </Screen>
  );
}

function SheetLine({ icon, text }: { icon: 'ticket-outline' | 'car-outline' | 'location-outline'; text: string }) {
  const s = useStyles();
  return (
    <View style={s.sheetLine}>
      <Icon name={icon} size={16} color="ink2" />
      <Text variant="caption" color="ink" style={s.flex}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  map: { borderRadius: t.radius.lg, marginTop: 4, marginBottom: 14 },
  card: { gap: 14, marginBottom: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.primary },
  live: { backgroundColor: t.colors.success },
  cancelled: { backgroundColor: t.colors.ink3 },
  divider: { height: 1, backgroundColor: t.colors.line },
  roundBtns: { flexDirection: 'row', gap: 8 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  sosWrap: { alignItems: 'center', paddingVertical: 4, gap: 6 },
  sosCaption: { maxWidth: 300 },
  sentCard: { backgroundColor: t.colors.coralWash, borderRadius: t.radius.lg, padding: 16, gap: 6, borderWidth: 1, borderColor: t.colors.coral, marginBottom: 6 },
  sentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addContact: { marginLeft: -14 },
  emergency: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  sheetList: { gap: 10, backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: 12 },
  sheetLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));
