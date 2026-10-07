import { computeContribution, formatKm, formatRwf, kigaliTime, round1, type TripDetail } from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  FareBreakdownCard,
  HeaderIconButton,
  Icon,
  LoadingState,
  Screen,
  StatChip,
  StopList,
  Text,
  toast,
  VerificationChips,
} from '@/components';
import { TripMap } from '@/components/TripMap';
import { DriverTripView } from '@/features/driver/DriverTripView';
import { CarVisual } from '@/features/passenger/CarVisual';
import { DriverRow } from '@/features/passenger/DriverRow';
import { ErrorCard, errorCode } from '@/features/passenger/ErrorCard';
import { hapticSelect, hapticSuccess, hapticWarning } from '@/features/passenger/haptics';
import { firstName, recurringLabel, REQUEST_STATUS } from '@/features/passenger/labels';
import { SectionTitle } from '@/features/passenger/SectionTitle';
import { formatDay, formatDeparture, routeLabel } from '@/lib/format';
import { useJoinTrip, useMe, useTrip } from '@/lib/queries';
import { makeStyles } from '@/theme';

/** Trip detail. Drivers get their own management view; everyone else sees the passenger view. */
export default function TripDetailScreen() {
  const { id, board, alight } = useLocalSearchParams<{ id: string; board?: string; alight?: string }>();
  const trip = useTrip(id);

  if (trip.isPending) {
    return (
      <Screen header={{ title: 'Trip' }} scroll={false}>
        <LoadingState label="Loading the trip…" />
      </Screen>
    );
  }
  if (trip.isError) {
    return (
      <Screen header={{ title: 'Trip' }} scroll={false}>
        <ErrorState error={trip.error} title="Couldn't open this trip" onRetry={() => void trip.refetch()} />
      </Screen>
    );
  }
  if (trip.data.viewerRole === 'driver') return <DriverTripView trip={trip.data} />;
  return <PassengerTripView trip={trip.data} initialBoard={board} initialAlight={alight} />;
}

const ACTIVE = new Set(['pending', 'accepted']);

function PassengerTripView({ trip, initialBoard, initialAlight }: { trip: TripDetail; initialBoard?: string; initialAlight?: string }) {
  const s = useStyles();
  const { data: me } = useMe();
  const join = useJoinTrip();
  const { width: windowWidth } = useWindowDimensions();
  const stageWidth = Math.min(windowWidth, 560) - 40;
  const stops = trip.stops;
  const request = trip.myJoinRequest;
  const activeRequest = request && (ACTIVE.has(request.status) || request.bookingId) ? request : null;

  const [segment, setSegment] = useState(() => {
    if (activeRequest) return { board: activeRequest.boardStop.id, alight: activeRequest.alightStop.id };
    const bi = stops.findIndex((x) => x.id === initialBoard);
    const ai = stops.findIndex((x) => x.id === initialAlight);
    if (bi >= 0 && ai > bi) return { board: initialBoard!, alight: initialAlight! };
    return { board: stops[0]!.id, alight: stops[stops.length - 1]!.id };
  });

  const bi = stops.findIndex((x) => x.id === segment.board);
  const ai = stops.findIndex((x) => x.id === segment.alight);
  const boardStop = stops[bi]!;
  const alightStop = stops[ai]!;
  const segmentKm = round1(alightStop.cumulativeKm - boardStop.cumulativeKm);
  const contribution = useMemo(() => computeContribution({ segmentKm, seatsOffered: trip.seatsOffered, isEV: trip.isEV }), [segmentKm, trip.seatsOffered, trip.isEV]);
  const seatsLeft = trip.seatsOffered - Math.max(0, ...trip.legOccupancy.slice(bi, ai));
  const departed = Date.parse(trip.departureTime) < Date.now();
  const open = trip.status === 'published' && !departed;
  const canRequest = open && seatsLeft > 0 && !activeRequest;
  const driverFirst = firstName(trip.driver.name);
  const recurring = recurringLabel(trip.recurringDays);
  const notWoman = trip.womenOnly && me?.gender !== 'female';

  const setBoard = (stopId: string) => {
    hapticSelect();
    join.reset();
    // A stop exactly halfway between pick-up and drop-off moves the drop-off ("get off earlier").
    const i = stops.findIndex((x) => x.id === stopId);
    if (i > bi && i < ai && i - bi === ai - i) setSegment((x) => ({ ...x, alight: stopId }));
    else setSegment((x) => ({ ...x, board: stopId }));
  };
  const setAlight = (stopId: string) => {
    hapticSelect();
    join.reset();
    setSegment((x) => ({ ...x, alight: stopId }));
  };

  const requestToJoin = () => {
    join.mutate(
      { tripId: trip.id, boardStopId: segment.board, alightStopId: segment.alight },
      {
        onSuccess: (jr) => {
          hapticSuccess();
          toast.success('Request sent', `We'll let you know as soon as ${driverFirst} answers.`);
          router.push({ pathname: '/request/[id]', params: { id: jr.id } });
        },
        onError: (e) => {
          hapticWarning();
          if (errorCode(e) === 'ACCOUNT_SUSPENDED') toast.error('Your account is suspended', 'You can’t request seats right now. Contact support@takemehome.rw.');
        },
      },
    );
  };

  const footer = activeRequest ? (
    <View style={s.footerRow}>
      <View style={s.flex}>
        <Badge kind={activeRequest.bookingId ? 'success' : REQUEST_STATUS[activeRequest.status].badge} label={activeRequest.bookingId ? 'Seat confirmed' : REQUEST_STATUS[activeRequest.status].label} />
        <Text variant="caption" style={s.footerCaption} numberOfLines={1}>
          {activeRequest.boardStop.place.name} → {activeRequest.alightStop.place.name} · {formatRwf(activeRequest.total)}
        </Text>
      </View>
      {activeRequest.bookingId ? (
        <Button label="View ticket" icon="ticket" onPress={() => router.push({ pathname: '/booking/[id]', params: { id: activeRequest.bookingId! } })} testID="view-ticket" />
      ) : (
        <Button label="View request" iconRight="arrow-forward" onPress={() => router.push({ pathname: '/request/[id]', params: { id: activeRequest.id } })} testID="view-request" />
      )}
    </View>
  ) : (
    <>
      {join.error ? <ErrorCard error={join.error} fallbackTitle="Couldn't send your request" testID="join-error" /> : null}
      {!open ? (
        <Text variant="caption" align="center">
          {departed ? 'This trip has already left.' : 'This trip is no longer taking requests.'}
        </Text>
      ) : seatsLeft <= 0 ? (
        <Text variant="caption" align="center">
          No seats left between {boardStop.place.name} and {alightStop.place.name} — try a shorter part of the route.
        </Text>
      ) : null}
      <Button
        label={`Request to join · ${formatRwf(contribution.total)}`}
        size="lg"
        block
        loading={join.isPending}
        disabled={!canRequest}
        onPress={requestToJoin}
        testID="request-to-join"
      />
    </>
  );

  return (
    <Screen
      header={{
        title: routeLabel(stops),
        subtitle: formatDeparture(trip.departureTime),
        right: <HeaderIconButton icon="flag-outline" accessibilityLabel="Report this driver" onPress={() => router.push({ pathname: '/report', params: { userId: trip.driver.id } })} />,
      }}
      footer={footer}
    >
      {/* Car hero */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card padding={0} style={s.hero}>
          <View style={s.heroStage}>
            <View style={s.heroGlow} />
            <CarVisual vehicle={trip.vehicle} width={trip.vehicle.photos.length ? stageWidth : 270} height={trip.vehicle.photos.length ? 170 : 112} style={trip.vehicle.photos.length ? s.heroPhoto : null} />
            <View style={s.heroBadges}>
              {trip.womenOnly ? <Badge kind="womenOnly" /> : null}
              {trip.isEV ? <Badge kind="ev" label="Electric" /> : null}
            </View>
          </View>
          <View style={s.heroInfo}>
            <View style={s.flex}>
              <Text variant="h2">
                {trip.vehicle.make} {trip.vehicle.model}
              </Text>
              <Text variant="caption">
                {trip.vehicle.color} · {trip.vehicle.seats} seats{trip.vehicle.verified ? ' · vehicle verified' : ''}
              </Text>
            </View>
            <View style={s.plate} accessibilityLabel={`Plate ${trip.vehicle.plate}`}>
              <Text style={s.plateText}>{trip.vehicle.plate}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Driver */}
      <Card style={s.card}>
        <DriverRow user={trip.driver} size={52} right={<Text variant="caption">Driver</Text>} />
        <VerificationChips chips={trip.driver.verification} show={['phone', 'id', 'licence', 'vehicle']} />
      </Card>

      {/* When */}
      <View style={s.stats}>
        <StatChip label={formatDay(trip.departureTime)} value={kigaliTime(trip.departureTime)} icon="time-outline" tone="primary" />
        <StatChip label="Seats left" value={seatsLeft > 0 ? `${seatsLeft} of ${trip.seatsOffered}` : 'Full'} icon="people-outline" tone={seatsLeft > 0 ? 'success' : 'neutral'} />
        <StatChip label="You ride" value={formatKm(segmentKm)} icon="navigate-outline" style={s.statWhite} />
      </View>
      {recurring ? (
        <View style={s.repeat}>
          <Icon name="repeat" size={15} color="ink2" />
          <Text variant="caption">
            {driverFirst} drives this {recurring.toLowerCase()} at {kigaliTime(trip.departureTime)}
          </Text>
        </View>
      ) : null}

      {trip.womenOnly ? (
        <Card variant="tinted" style={s.note}>
          <Icon name="female" size={18} color="primary2" />
          <Text variant="caption" color="ink" style={s.flex}>
            {notWoman
              ? 'Women-only trip: only women passengers can join. Set your gender in Profile if this applies to you.'
              : `Women-only trip: ${driverFirst} only takes women passengers on this ride.`}
          </Text>
        </Card>
      ) : null}

      {/* Corridor */}
      <SectionTitle title="Route" style={s.sectionGap} />
      <TripMap
        routeStops={stops.map((x) => x.place)}
        boardPlaceId={boardStop.placeId}
        alightPlaceId={alightStop.placeId}
        height={210}
        style={s.map}
      />

      <Card style={s.card}>
        <View style={s.stopsHead}>
          <Text variant="h3">{activeRequest ? 'Your stops' : 'Where do you get on and off?'}</Text>
          <Animated.View key={`${segment.board}-${segment.alight}`} entering={FadeIn.duration(200)} style={s.segmentPill}>
            <Text style={s.segmentPillText}>{formatKm(segmentKm)}</Text>
          </Animated.View>
        </View>
        {!activeRequest ? (
          <Text variant="caption" style={s.stopsHint}>
            Tap a stop to move your pick-up or drop-off. You only pay for the part you ride.
          </Text>
        ) : null}
        <StopList
          stops={stops}
          boardStopId={segment.board}
          alightStopId={segment.alight}
          onSelectBoard={activeRequest ? undefined : setBoard}
          onSelectAlight={activeRequest ? undefined : setAlight}
        />
      </Card>

      <Animated.View key={contribution.total} entering={FadeIn.duration(220)}>
        <FareBreakdownCard
          segmentKm={segmentKm}
          seatsOffered={trip.seatsOffered}
          costShare={contribution.costShare}
          bookingFee={contribution.bookingFee}
          total={contribution.total}
          isEV={trip.isEV}
          style={s.fare}
        />
      </Animated.View>

      {request && !activeRequest ? (
        <Text variant="caption" align="center" style={s.oldRequest}>
          Your earlier request on this trip was {request.status}. You can ask again.
        </Text>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  hero: { overflow: 'hidden', marginTop: 4, marginBottom: 14 },
  heroStage: { height: 170, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: t.colors.surface, opacity: 0.55, bottom: -190 },
  heroPhoto: { borderRadius: 0 },
  heroBadges: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 },
  heroInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  plate: {
    borderWidth: 2,
    borderColor: t.colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: t.colors.surface,
  },
  plateText: { fontFamily: t.fonts.headingHeavy, fontSize: 15, letterSpacing: 1.2, color: t.colors.ink },
  card: { gap: 14, marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statWhite: { backgroundColor: t.colors.surface, ...t.shadows.sm },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, paddingHorizontal: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionGap: { marginTop: 8 },
  map: { borderRadius: t.radius.lg, marginBottom: 14 },
  stopsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stopsHint: { marginTop: -8 },
  segmentPill: { backgroundColor: t.colors.tint, borderRadius: t.radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  segmentPillText: { fontFamily: t.fonts.heading, fontSize: 13, color: t.colors.primary },
  fare: { marginBottom: 8 },
  oldRequest: { marginTop: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerCaption: { marginTop: 4 },
}));
