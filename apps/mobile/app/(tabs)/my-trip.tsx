import { formatRwf, kigaliTime, MAX_TRIPS_PER_DAY, type DriverDashboard, type TripDetail } from '@tmh/shared';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Button,
  CarIllustration,
  Card,
  EmptyState,
  ErrorState,
  HeaderIconButton,
  Icon,
  LoadingState,
  Screen,
  Text,
  TwoTripMeter,
} from '@/components';
import { DriverTripRow } from '@/features/driver/DriverTripsList';
import { LedgerCard } from '@/features/driver/LedgerCard';
import { PassengerList, passengerRows } from '@/features/driver/PassengerList';
import { RequestsList } from '@/features/driver/RequestsList';
import { Section } from '@/features/driver/Section';
import { TripActions } from '@/features/driver/TripActions';
import { TripHeroCard } from '@/features/driver/TripHeroCard';
import { formatDay } from '@/lib/format';
import { useDriverDashboard, useHistory, useMe, useUnreadCount } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';

/**
 * Driver dashboard. Realtime: the RealtimeBridge invalidates the dashboard query on
 * `join_request:updated` / `payment:updated` / `trip:updated`, so requests and payments appear
 * here without a reload.
 */
export default function MyTripTab() {
  const s = useStyles();
  const { colors } = useTheme();
  const dash = useDriverDashboard();
  const { data: me } = useMe();
  const unread = useUnreadCount();
  const firstName = me?.name.split(' ')[0] ?? '';

  const header = (
    <View style={s.header}>
      <View style={s.flex}>
        <Text variant="caption">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text variant="h1">My Trip</Text>
      </View>
      <HeaderIconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" badge={unread > 0} />
    </View>
  );

  if (dash.isPending) {
    return (
      <Screen tabBarSpace scroll={false}>
        {header}
        <LoadingState label="Loading your trips…" />
      </Screen>
    );
  }
  if (dash.isError) {
    return (
      <Screen tabBarSpace scroll={false}>
        {header}
        <ErrorState error={dash.error} title="Couldn't load your dashboard" onRetry={() => void dash.refetch()} />
      </Screen>
    );
  }

  const d = dash.data;
  const refresh = <RefreshControl refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()} tintColor={colors.primary} />;

  return (
    <Screen tabBarSpace refreshControl={refresh} testID="my-trip">
      {header}
      {me?.status === 'suspended' ? (
        <Card variant="outlined" style={s.suspended}>
          <Icon name="alert-circle" size={20} color="coral" />
          <Text variant="caption" color="ink" style={s.flex}>
            Your account is suspended, so you can&apos;t publish or manage trips right now. Contact support if you think this is a mistake.
          </Text>
        </Card>
      ) : null}

      {!d.hasVehicle ? (
        <VehicleOnboarding />
      ) : !d.focusTrip ? (
        <NoTrips dashboard={d} />
      ) : (
        <FocusTrip dashboard={d} focus={d.focusTrip} />
      )}
    </Screen>
  );
}

function greeting(): string {
  const hour = Number(kigaliTime(new Date()).slice(0, 2));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** No vehicle yet: the friendly first step. */
function VehicleOnboarding() {
  const s = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card style={s.onboard} testID="vehicle-onboarding">
        <View style={s.onboardArt}>
          <CarIllustration color="Silver" width={220} />
        </View>
        <Text variant="h2" align="center">
          Add your car to start sharing rides
        </Text>
        <Text variant="body" color="ink2" align="center">
          Already driving across Kigali? Offer your empty seats on the trips you make anyway, and passengers going your way chip in for fuel and wear.
        </Text>
        <View style={s.steps}>
          <Step n={1} title="Add your car" body="Make, plate, colour and a photo or two." />
          <Step n={2} title="Publish the trip you're already making" body="Pick your route — we suggest the stops along the way." />
          <Step n={3} title="Accept requests to join" body="Passengers pay a capped cost share. You never profit — you just stop carrying the whole cost." />
        </View>
        <Button label="Add your car" icon="car-sport" size="lg" block onPress={() => router.push('/vehicle/new')} testID="add-vehicle-cta" />
      </Card>
    </Animated.View>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  const s = useStyles();
  return (
    <View style={s.step}>
      <View style={s.stepNum}>
        <Text style={s.stepNumText}>{n}</Text>
      </View>
      <View style={s.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption">{body}</Text>
      </View>
    </View>
  );
}

/** Has a car but no upcoming trips. */
function NoTrips({ dashboard }: { dashboard: DriverDashboard }) {
  const s = useStyles();
  return (
    <>
      <RecentTripCard />
      <Card style={s.emptyCard}>
        <EmptyState
          icon="add-circle"
          title="Publish the trip you're already making"
          body="Going to work, coming home, the school run — publish it with your empty seats and let people on your route request to join."
          action={{ label: 'Publish a trip', icon: 'add-circle', onPress: () => router.navigate('/publish') }}
        />
      </Card>
      <Section title="Today">
        <Card>
          <TwoTripMeter used={dashboard.dailyMeter.used} limit={dashboard.dailyMeter.limit} />
          <Text variant="caption" style={s.meterNote}>
            Take Me Home is for trips you already make: up to {MAX_TRIPS_PER_DAY} a day — one out, one back.
          </Text>
        </Card>
      </Section>
    </>
  );
}

function FocusTrip({ dashboard, focus }: { dashboard: DriverDashboard; focus: TripDetail }) {
  const s = useStyles();
  const requests = focus.joinRequests ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const rows = passengerRows(focus);
  const others = dashboard.upcomingTrips.filter((t) => t.id !== focus.id);
  const onTheRoad = focus.status === 'in_progress';

  return (
    <>
      <RecentTripCard />
      <Animated.View entering={FadeInDown.duration(300)}>
        <TripHeroCard
          trip={focus}
          eyebrow={onTheRoad ? 'On the road now' : 'Next trip'}
          pendingCount={pendingCount}
          onPress={() => router.push(`/trip/${focus.id}`)}
          testID="focus-trip"
        />
      </Animated.View>

      <View style={s.actions}>
        <TripActions trip={focus} onCompleted={(t) => router.push(`/trip/${t.id}`)} />
      </View>

      {!onTheRoad ? (
        <Section
          title="Requests to join"
          count={pendingCount}
          countTone="accent"
          subtitle={pendingCount ? 'Accept to hold a seat — the passenger then pays their contribution with MoMo.' : undefined}
          testID="requests-section"
        >
          <RequestsList requests={requests} />
        </Section>
      ) : null}

      <Section title="Passengers" count={rows.length} testID="passengers-section">
        <Card padding={16} style={s.listCard}>
          <PassengerList trip={focus} />
        </Card>
      </Section>

      {focus.ledger ? (
        <Section title="Running cost">
          <LedgerCard ledger={focus.ledger} seatsOffered={focus.seatsOffered} />
        </Section>
      ) : null}

      <Section title="Your daily trips">
        <Card style={s.meterCard}>
          <TwoTripMeter used={dashboard.dailyMeter.used} limit={dashboard.dailyMeter.limit} />
          {dashboard.returnTripDraft ? <ReturnTripShortcut draft={dashboard.returnTripDraft} focus={focus} /> : null}
        </Card>
      </Section>

      {others.length ? (
        <Section title="Other upcoming trips" count={others.length} action={{ label: 'All trips', onPress: () => router.navigate('/trips') }}>
          <View style={s.others}>
            {others.slice(0, 4).map((t) => (
              <DriverTripRow key={t.id} trip={t} />
            ))}
          </View>
        </Section>
      ) : null}
    </>
  );
}

function ReturnTripShortcut({ draft, focus }: { draft: NonNullable<DriverDashboard['returnTripDraft']>; focus: TripDetail }) {
  const s = useStyles();
  const full = draft.meterForDay.used >= draft.meterForDay.limit;
  const day = formatDay(`${draft.dayKey}T12:00:00.000Z`);
  const from = focus.stops[focus.stops.length - 1]?.place.name;
  const to = focus.stops[0]?.place.name;

  const open = () =>
    router.navigate({
      pathname: '/publish',
      params: {
        from: draft.stopPlaceIds[0],
        to: draft.stopPlaceIds[draft.stopPlaceIds.length - 1],
        stops: draft.stopPlaceIds.join(','),
        day: draft.dayKey,
        vehicleId: draft.vehicleId,
        seats: String(draft.seatsOffered),
        womenOnly: draft.womenOnly ? '1' : '0',
        prefill: String(Date.now()),
      },
    });

  return (
    <View style={s.returnBox} testID="return-trip">
      <View style={s.returnHead}>
        <View style={s.returnIcon}>
          <Icon name="swap-vertical" size={18} color="primary" />
        </View>
        <View style={s.flex}>
          <Text variant="bodyStrong">Publish your return trip</Text>
          <Text variant="caption">
            {from} → {to} · {day}
          </Text>
        </View>
      </View>
      <TwoTripMeter used={draft.meterForDay.used} limit={draft.meterForDay.limit} dayLabel={day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : `on ${day}`} />
      {full ? (
        <View style={s.limitNote}>
          <Icon name="information-circle" size={16} color="accentInk" />
          <Text variant="caption" color="accentInk" style={s.flex}>
            You already have {draft.meterForDay.used} trips on {day} — one out, one back. That&apos;s the daily limit, so there&apos;s no room for another.
          </Text>
        </View>
      ) : null}
      <Button
        label={full ? 'Daily limit reached' : 'Publish return trip'}
        icon={full ? 'lock-closed' : 'return-up-back'}
        variant={full ? 'secondary' : 'primary'}
        block
        disabled={full}
        onPress={open}
        testID="return-trip-cta"
      />
    </View>
  );
}

/** The most recent completed trip (last 2 days), so ratings are one tap away after completing. */
function RecentTripCard() {
  const s = useStyles();
  const history = useHistory();
  const recent = history.data?.find(
    (h) => h.role === 'driver' && h.status === 'completed' && Date.now() - Date.parse(h.trip.departureTime) < 2 * 24 * 3600_000,
  );
  if (!recent) return null;
  const from = recent.trip.stops[0]?.place.name;
  const to = recent.trip.stops[recent.trip.stops.length - 1]?.place.name;
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Card variant="tinted" onPress={() => router.push(`/trip/${recent.trip.id}`)} style={s.recent} testID="recent-trip">
        <View style={s.recentIcon}>
          <Icon name="checkmark-done" size={20} color="success" />
        </View>
        <View style={s.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            Completed · {from} → {to}
          </Text>
          <Text variant="caption" numberOfLines={2}>
            {formatRwf(recent.amount)} recovered {formatDay(recent.trip.departureTime).toLowerCase()}. Rate your passengers and see the ledger.
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color="primary" />
      </Card>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 16 },
  suspended: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, borderColor: t.colors.coral, backgroundColor: t.colors.coralWash },
  onboard: { gap: 14, paddingVertical: 24 },
  onboardArt: { alignItems: 'center', backgroundColor: t.colors.tint, borderRadius: t.radius.md, paddingVertical: 20, marginBottom: 4 },
  steps: { gap: 14, marginVertical: 6 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: t.fonts.heading, fontSize: 14, color: t.colors.onPrimary },
  emptyCard: { paddingVertical: 0 },
  meterNote: { marginTop: 10 },
  actions: { marginTop: 16 },
  listCard: { paddingVertical: 4 },
  meterCard: { gap: 16 },
  returnBox: { gap: 12, borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: 16 },
  returnHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  returnIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  limitNote: { flexDirection: 'row', gap: 8, backgroundColor: t.colors.accent2, borderRadius: t.radius.sm, padding: 12 },
  others: { gap: 10 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  recentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.mint, alignItems: 'center', justifyContent: 'center' },
}));
