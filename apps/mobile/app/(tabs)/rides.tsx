import { type Place } from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Chip, EmptyState, ErrorState, Icon, LoadingState, Screen, Text } from '@/components';
import { PlacePickerSheet } from '@/features/passenger/PlacePickerSheet';
import { TripCard } from '@/features/passenger/TripCard';
import { hapticSelect } from '@/features/passenger/haptics';
import { useMe, usePlaces, useSearchTrips } from '@/lib/queries';
import { makeStyles } from '@/theme';

type When = 'today' | 'tomorrow' | 'week';
const WHEN: { value: When; label: string; phrase: string }[] = [
  { value: 'today', label: 'Today', phrase: 'today' },
  { value: 'tomorrow', label: 'Tomorrow', phrase: 'tomorrow' },
  { value: 'week', label: 'This week', phrase: 'this week' },
];
const isWhen = (v: unknown): v is When => v === 'today' || v === 'tomorrow' || v === 'week';

/** Rides tab — search trips whose corridor covers From → To, by day. */
export default function RidesTab() {
  const s = useStyles();
  const params = useLocalSearchParams<{ from?: string; to?: string; when?: string }>();
  const { data: me } = useMe();
  const { data: places = [] } = usePlaces();
  const [from, setFrom] = useState<string | null>(params.from ?? null);
  const [to, setTo] = useState<string | null>(params.to ?? null);
  const [when, setWhen] = useState<When>(isWhen(params.when) ? params.when : 'tomorrow');
  const [womenOnly, setWomenOnly] = useState(false);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);

  // The home search card navigates here with fresh params while the tab may already be mounted.
  useEffect(() => {
    if (params.from !== undefined) setFrom(params.from || null);
    if (params.to !== undefined) setTo(params.to || null);
    if (isWhen(params.when)) setWhen(params.when);
  }, [params.from, params.to, params.when]);

  const isFemale = me?.gender === 'female';
  const query = { from: from ?? undefined, to: to ?? undefined, when, womenOnly: isFemale && womenOnly ? ('true' as const) : undefined };
  const search = useSearchTrips(query);
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name;
  const fromName = placeName(from);
  const toName = placeName(to);
  const phrase = WHEN.find((w) => w.value === when)!.phrase;

  const choose = (p: Place) => {
    hapticSelect();
    if (picker === 'from') setFrom(p.id);
    else setTo(p.id);
    setPicker(null);
  };

  const swap = () => {
    hapticSelect();
    setFrom(to);
    setTo(from);
  };

  const journey = fromName && toName ? `${fromName} → ${toName}` : fromName ? `from ${fromName}` : toName ? `to ${toName}` : null;
  const results = search.data ?? [];

  return (
    <Screen
      tabBarSpace
      refreshControl={<RefreshControl refreshing={search.isRefetching} onRefresh={() => void search.refetch()} />}
    >
      <View style={s.intro}>
        <Text variant="h1">Find a ride</Text>
        <Text variant="body" color="ink2">
          Seats on trips people are already making.
        </Text>
      </View>

      <Card style={s.searchCard} padding={0}>
        <View style={s.fields}>
          <View style={s.rail}>
            <View style={[s.dot, s.dotFrom]} />
            <View style={s.railLine} />
            <View style={[s.dot, s.dotTo]} />
          </View>
          <View style={s.fieldCol}>
            <Field label="From" value={fromName} placeholder="Where are you starting?" onPress={() => setPicker('from')} testID="search-from" />
            <View style={s.fieldDivider} />
            <Field label="To" value={toName} placeholder="Where are you going?" onPress={() => setPicker('to')} testID="search-to" />
          </View>
          <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel="Swap from and to" hitSlop={8} style={({ pressed }) => [s.swap, pressed ? s.pressed : null]} testID="search-swap">
            <Icon name="swap-vertical" size={20} color="primary" />
          </Pressable>
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsScroll}>
        {WHEN.map((w) => (
          <Chip
            key={w.value}
            label={w.label}
            icon={w.value === 'week' ? 'calendar-outline' : undefined}
            selected={when === w.value}
            onPress={() => {
              hapticSelect();
              setWhen(w.value);
            }}
          />
        ))}
        {isFemale ? (
          <Chip label="Women-only" icon="female" selected={womenOnly} onPress={() => setWomenOnly((v) => !v)} />
        ) : null}
      </ScrollView>

      {search.isPending ? (
        <LoadingState label="Finding trips going your way…" fill={false} />
      ) : search.isError ? (
        <ErrorState error={search.error} title="Couldn't search trips" onRetry={() => void search.refetch()} fill={false} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title={journey ? `No trips cover ${journey} ${phrase}` : `No trips ${phrase} yet`}
          body={
            when === 'week'
              ? 'Drivers publish the trips they already make, often the evening before. Check back soon.'
              : 'Try This week — or check back later; drivers often publish the evening before.'
          }
          action={when !== 'week' ? { label: 'Show this week', icon: 'calendar-outline', onPress: () => setWhen('week') } : undefined}
        />
      ) : (
        <View>
          <Text variant="label" style={s.count}>
            {results.length} trip{results.length === 1 ? '' : 's'}
            {journey ? ` · ${journey}` : ''} · {phrase}
          </Text>
          {results.map((m, i) => (
            <Animated.View key={m.trip.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(260)}>
              <TripCard
                match={m}
                style={s.result}
                testID={`result-${i}`}
                onPress={() => router.push({ pathname: '/trip/[id]', params: { id: m.trip.id, board: m.boardStopId, alight: m.alightStopId } })}
              />
            </Animated.View>
          ))}
        </View>
      )}

      <PlacePickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'from' ? 'Leaving from' : 'Going to'}
        selectedId={picker === 'from' ? from : to}
        excludeId={picker === 'from' ? to : from}
        onSelect={choose}
      />
    </Screen>
  );
}

function Field({ label, value, placeholder, onPress, testID }: { label: string; value?: string; placeholder: string; onPress: () => void; testID?: string }) {
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'not set'}`} style={({ pressed }) => [s.field, pressed ? s.pressed : null]} testID={testID}>
      <Text variant="caption">{label}</Text>
      <Text variant="bodyStrong" color={value ? 'ink' : 'ink3'} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  intro: { marginTop: 12, marginBottom: 16, gap: 2 },
  searchCard: { marginBottom: 14 },
  fields: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingLeft: 16, paddingRight: 12, gap: 12 },
  rail: { alignItems: 'center', paddingVertical: 22, alignSelf: 'stretch' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  dotFrom: { backgroundColor: t.colors.primary, borderColor: t.colors.tint },
  dotTo: { backgroundColor: t.colors.accent, borderColor: t.colors.accent2 },
  railLine: { flex: 1, width: 2, backgroundColor: t.colors.line, marginVertical: 3 },
  fieldCol: { flex: 1 },
  field: { paddingVertical: 10, gap: 1 },
  fieldDivider: { height: 1, backgroundColor: t.colors.line },
  swap: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  chipsScroll: { marginHorizontal: -20, marginBottom: 18, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20 },
  count: { marginBottom: 10 },
  result: { marginBottom: 12 },
}));
