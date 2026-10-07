import { formatRwf, type Place } from '@tmh/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, EmptyState, ErrorState, HeaderIconButton, Icon, LoadingState, Screen, Text } from '@/components';
import { TripMap, type MapPin } from '@/components/TripMap';
import { PlacePickerSheet } from '@/features/passenger/PlacePickerSheet';
import { SectionTitle } from '@/features/passenger/SectionTitle';
import { TripMiniCard } from '@/features/passenger/TripCard';
import { hapticSelect } from '@/features/passenger/haptics';
import { firstName } from '@/features/passenger/labels';
import { formatDeparture } from '@/lib/format';
import { useMapTrips, useMe, useMyBookings, usePlaces, useUnreadCount } from '@/lib/queries';
import { makeStyles } from '@/theme';

const MAP_HEIGHT = 400;
/** How far the floating search card overlaps the bottom of the map. */
const SEARCH_OVERLAP = 72;

/** Home — map-first: tomorrow's published trips as car pins, a floating search card, and a rail of trips. */
export default function HomeTab() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const unread = useUnreadCount();
  const { data: places = [] } = usePlaces();
  const trips = useMapTrips('tomorrow');
  const bookings = useMyBookings();

  const homePlace = places.find((p) => p.name === me?.homeArea);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const fromId = from ?? homePlace?.id ?? null;
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name;

  // One car pin per trip, at its origin; trips leaving from the same stop are nudged apart.
  const pins = useMemo<MapPin[]>(() => {
    const seen = new Map<string, number>();
    return (trips.data ?? []).map((t) => {
      const origin = t.stops[0]!.place;
      const n = seen.get(origin.id) ?? 0;
      seen.set(origin.id, n + 1);
      return {
        id: t.id,
        lat: origin.lat - n * 0.0045,
        lng: origin.lng + n * 0.004,
        title: t.stops[t.stops.length - 1]!.place.name,
        fromAmount: t.fullRouteContribution.total,
      };
    });
  }, [trips.data]);

  const nextRide = useMemo(
    () =>
      (bookings.data ?? [])
        .filter((b) => b.viewerRole === 'passenger' && b.status === 'confirmed')
        .sort((a, b) => Date.parse(a.trip.departureTime) - Date.parse(b.trip.departureTime))[0],
    [bookings.data],
  );

  const goSearch = (f: string | null, t: string | null) =>
    router.navigate({ pathname: '/rides', params: { from: f ?? '', to: t ?? '', when: 'tomorrow' } });

  const choose = (p: Place) => {
    hapticSelect();
    setPicker(null);
    if (picker === 'from') {
      setFrom(p.id);
      if (to) goSearch(p.id, to);
    } else {
      setTo(p.id);
      goSearch(fromId, p.id);
    }
  };

  const tripCount = trips.data?.length ?? 0;

  return (
    <Screen
      tabBarSpace
      edgeToEdgeTop
      padding={0}
      refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={() => void trips.refetch()} />}
    >
      <View style={s.mapWrap}>
        <TripMap
          height={MAP_HEIGHT + insets.top}
          insetTop={insets.top + 40}
          insetBottom={SEARCH_OVERLAP}
          pins={pins}
          onPinPress={(id) => router.push({ pathname: '/trip/[id]', params: { id } })}
        />
        <View style={[s.topBar, { top: insets.top + 10 }]}>
          <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel="Your profile" style={({ pressed }) => [s.hello, pressed ? s.pressed : null]}>
            <Avatar name={me?.name ?? '?'} photoUrl={me?.photoUrl} size={36} />
            <View>
              <Text variant="caption" style={s.helloSmall}>
                Muraho,
              </Text>
              <Text variant="h3" numberOfLines={1} style={s.helloName}>
                {me ? firstName(me.name) : 'friend'} 👋
              </Text>
            </View>
          </Pressable>
          <HeaderIconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ''}`} badge={unread > 0} />
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(320)} style={s.searchWrap}>
        <Card style={s.searchCard}>
          <View>
            <Text variant="h2">Where are you going?</Text>
            <Text variant="caption">
              {tripCount > 0 ? `${tripCount} trip${tripCount === 1 ? '' : 's'} published for tomorrow — tap a car on the map` : 'Find a seat on a trip that’s already going your way'}
            </Text>
          </View>
          <View style={s.fields}>
            <SearchField icon="radio-button-on" iconColor="primary" label="From" value={placeName(fromId)} placeholder="Pick your stop" onPress={() => setPicker('from')} testID="home-from" />
            <View style={s.fieldDivider} />
            <SearchField icon="location" iconColor="accent" label="To" value={placeName(to)} placeholder="Where to?" onPress={() => setPicker('to')} testID="home-to" />
          </View>
          <Button label="Search rides" icon="search" block onPress={() => goSearch(fromId, to)} testID="home-search" />
        </Card>
      </Animated.View>

      <View style={s.body}>
        {nextRide ? (
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <Card variant="tinted" onPress={() => router.push({ pathname: '/booking/[id]', params: { id: nextRide.id } })} style={s.nextRide}>
              <View style={s.nextIcon}>
                <Icon name="ticket" size={20} color="onPrimary" />
              </View>
              <View style={s.flex}>
                <Text variant="label" color="primary">
                  Your next ride · {nextRide.tripCode}
                </Text>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {nextRide.boardStop.place.name} → {nextRide.alightStop.place.name}
                </Text>
                <Text variant="caption">{formatDeparture(nextRide.trip.departureTime)} with {firstName(nextRide.driver.name)}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color="primary" />
            </Card>
          </Animated.View>
        ) : null}

        <SectionTitle
          title="Tomorrow's trips"
          right={
            tripCount > 0 ? (
              <Pressable onPress={() => goSearch(null, null)} hitSlop={8} accessibilityRole="button">
                <Text variant="bodyStrong" color="primary">
                  See all
                </Text>
              </Pressable>
            ) : null
          }
        />
      </View>

      {trips.isPending ? (
        <LoadingState label="Loading tomorrow's trips…" fill={false} />
      ) : trips.isError ? (
        <ErrorState error={trips.error} title="Couldn't load trips" onRetry={() => void trips.refetch()} fill={false} />
      ) : tripCount === 0 ? (
        <EmptyState
          icon="moon-outline"
          title="No trips published for tomorrow yet"
          body="Drivers usually publish the trips they already make the evening before. Search the week to see what's coming."
          action={{ label: 'Search this week', icon: 'calendar-outline', onPress: () => router.navigate({ pathname: '/rides', params: { when: 'week' } }) }}
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
          {trips.data!.map((t, i) => (
            <Animated.View key={t.id} entering={FadeInRight.delay(i * 60).duration(300)}>
              <TripMiniCard trip={t} testID={`home-trip-${i}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })} />
            </Animated.View>
          ))}
        </ScrollView>
      )}

      {tripCount > 0 ? (
        <View style={s.footNote}>
          <Icon name="leaf-outline" size={14} color="ink2" />
          <Text variant="caption" style={s.flex}>
            Prices are a capped share of running costs — from {formatRwf(Math.min(...trips.data!.map((t) => t.fullRouteContribution.total)))} for a whole route. Drivers never profit.
          </Text>
        </View>
      ) : null}

      <PlacePickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'from' ? 'Leaving from' : 'Going to'}
        selectedId={picker === 'from' ? fromId : to}
        excludeId={picker === 'from' ? to : fromId}
        onSelect={choose}
      />
    </Screen>
  );
}

function SearchField({
  icon,
  iconColor,
  label,
  value,
  placeholder,
  onPress,
  testID,
}: {
  icon: 'radio-button-on' | 'location';
  iconColor: 'primary' | 'accent';
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  testID?: string;
}) {
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'not set'}`} style={({ pressed }) => [s.field, pressed ? s.pressed : null]} testID={testID}>
      <Icon name={icon} size={18} color={iconColor} />
      <View style={s.flex}>
        <Text variant="caption">{label}</Text>
        <Text variant="bodyStrong" color={value ? 'ink' : 'ink3'} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
      </View>
      <Icon name="chevron-down" size={16} color="ink3" />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  mapWrap: { position: 'relative' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 4,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    maxWidth: '75%',
    ...t.shadows.sm,
  },
  helloSmall: { fontSize: 11, lineHeight: 13 },
  helloName: { lineHeight: 19 },
  searchWrap: { marginTop: -SEARCH_OVERLAP, paddingHorizontal: 16 },
  searchCard: { gap: 12, padding: 18, ...t.shadows.lg },
  fields: { borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radius.md, paddingHorizontal: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  fieldDivider: { height: 1, backgroundColor: t.colors.line, marginLeft: 30 },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  nextRide: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  nextIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  rail: { gap: 12, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 16 },
  footNote: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 4, alignItems: 'flex-start' },
}));
