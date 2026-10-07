import {
  addDays,
  BOOKING_FEE,
  BOOKING_FEE_EV,
  buildCorridor,
  formatKm,
  KIGALI_PLACES,
  kigaliDateTime,
  kigaliDayKey,
  kigaliTime,
  kigaliWeekday,
  MAX_SEATS,
  suggestCorridor,
  WEEKDAYS,
  type CorridorStop,
  type Me,
  type Vehicle,
  type Weekday,
} from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Badge, Button, CarIllustration, Card, Chip, EmptyState, Icon, Screen, Text, toast, TwoTripMeter } from '@/components';
import { TripMap } from '@/components/TripMap';
import { hapticNotify, hapticTap } from '@/features/driver/haptics';
import { PlaceSheet } from '@/features/driver/PlaceSheet';
import { PricePreview } from '@/features/driver/PricePreview';
import { NumberStepper, roundToSlot, TimeStepper, toMinutes } from '@/features/driver/Steppers';
import { ToggleRow } from '@/features/driver/ToggleRow';
import { WEEKDAY_SHORT } from '@/features/driver/tripMeta';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDay, formatDeparture } from '@/lib/format';
import { useDriverMeter, useMe, usePublishTrip, useVehicles } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';

type Params = {
  from?: string;
  to?: string;
  stops?: string;
  day?: string;
  time?: string;
  vehicleId?: string;
  seats?: string;
  womenOnly?: string;
  prefill?: string;
};

interface Form {
  vehicleId: string | null;
  from: string | null;
  to: string | null;
  /** Places the driver chose to go through (forces the route). */
  vias: string[];
  /** Intermediate route stops the driver won't serve. */
  skipped: string[];
  dayKey: string;
  time: string;
  recurring: boolean;
  days: Weekday[];
  seats: number;
  womenOnly: boolean;
}

const WORK_DAYS = WEEKDAYS.slice(0, 5) as Weekday[];
const placeName = (id: string) => KIGALI_PLACES.find((p) => p.id === id)?.name ?? id;
const placeLandmark = (id: string) => KIGALI_PLACES.find((p) => p.id === id)?.landmark ?? '';
const placeByName = (name: string | null | undefined) => KIGALI_PLACES.find((p) => p.name === name)?.id ?? null;
const todayKey = () => kigaliDayKey(Date.now());

function defaultForm(me: Me | undefined): Form {
  return {
    vehicleId: me?.vehicles[0]?.id ?? null,
    from: placeByName(me?.homeArea),
    to: null,
    vias: [],
    skipped: [],
    dayKey: addDays(todayKey(), 1),
    time: '07:00',
    recurring: false,
    days: WORK_DAYS,
    seats: 3,
    womenOnly: false,
  };
}

/** Builds the form from `?from=&to=&stops=&day=&vehicleId=&seats=` (the return-trip shortcut). */
function formFromParams(p: Params, base: Form): Form {
  const from = p.from && KIGALI_PLACES.some((x) => x.id === p.from) ? p.from : base.from;
  const to = p.to && KIGALI_PLACES.some((x) => x.id === p.to) ? p.to : base.to;
  let vias: string[] = [];
  let skipped: string[] = [];
  if (from && to && p.stops) {
    const wanted = p.stops.split(',').filter(Boolean);
    const inter = wanted.slice(1, -1);
    const baseRoute = suggestCorridor(from, to)?.route ?? [];
    vias = inter.filter((id) => !baseRoute.includes(id));
    const route = suggestCorridor(from, to, vias)?.route ?? baseRoute;
    skipped = route.slice(1, -1).filter((id) => !inter.includes(id));
  }
  const seats = Number(p.seats);
  return {
    ...base,
    from,
    to,
    vias,
    skipped,
    vehicleId: p.vehicleId ?? base.vehicleId,
    dayKey: p.day && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? p.day : base.dayKey,
    time: p.time && /^\d{2}:\d{2}$/.test(p.time) ? roundToSlot(p.time) : p.day ? '17:30' : base.time,
    seats: Number.isInteger(seats) && seats >= 1 ? seats : base.seats,
    womenOnly: p.womenOnly === '1',
    recurring: false,
  };
}

/** Publish a trip the driver is already making: car, corridor, time, seats → capped contribution preview. */
export default function PublishTab() {
  const s = useStyles();
  const params = useLocalSearchParams<Params>();
  const { data: me } = useMe();
  const vehiclesQ = useVehicles();
  const vehicles: Vehicle[] = vehiclesQ.data ?? me?.vehicles ?? [];
  const publish = usePublishTrip();

  const [form, setForm] = useState<Form>(() => defaultForm(me));
  const [sheet, setSheet] = useState<'from' | 'to' | null>(null);

  // Apply route-param prefill (return-trip shortcut) once per distinct request — during render, not in an effect.
  const prefillKey = params.prefill ?? (params.from && params.to ? `${params.from}|${params.to}|${params.stops ?? ''}|${params.day ?? ''}` : null);
  const [appliedPrefill, setAppliedPrefill] = useState<string | null>(null);
  if (prefillKey && prefillKey !== appliedPrefill) {
    setAppliedPrefill(prefillKey);
    setForm((f) => formFromParams(params, f));
  }

  const update = (patch: Partial<Form>) => {
    if (publish.isError) publish.reset();
    setForm((f) => ({ ...f, ...patch }));
  };

  // ─── derived ────────────────────────────────────────────────────────────────
  const vehicle = vehicles.find((v) => v.id === form.vehicleId) ?? vehicles[0] ?? null;
  const maxSeats = vehicle ? Math.max(1, Math.min(MAX_SEATS, vehicle.seats - 1)) : MAX_SEATS;
  const seats = Math.min(Math.max(form.seats, 1), maxSeats);
  const canWomenOnly = me?.gender === 'female';
  const womenOnly = canWomenOnly && form.womenOnly;
  const isEV = Boolean(vehicle?.isEV);

  const suggestion = useMemo(() => (form.from && form.to ? suggestCorridor(form.from, form.to, form.vias) : null), [form.from, form.to, form.vias]);
  const route = useMemo(() => suggestion?.route ?? [], [suggestion]);
  const routeKm = useMemo(() => safeCorridor(route), [route]);
  const served = useMemo(() => route.filter((id, i) => i === 0 || i === route.length - 1 || !form.skipped.includes(id)), [route, form.skipped]);
  const corridor = useMemo(() => safeCorridor(served), [served]);
  const totalKm = corridor[corridor.length - 1]?.cumulativeKm ?? 0;

  const today = todayKey();
  const dayOptions = useMemo(() => {
    const list = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    if (!list.includes(form.dayKey)) list.push(form.dayKey);
    return list;
  }, [today, form.dayKey]);
  const isToday = form.dayKey === today;
  const minTime = isToday ? roundToSlot(kigaliTime(Date.now() + 5 * 60_000)) : null;
  const timeError = minTime && toMinutes(form.time) < toMinutes(minTime) ? 'That time has already passed — pick a later time or another day.' : null;
  const departure = kigaliDateTime(form.dayKey, form.time);
  const weekday = kigaliWeekday(departure);
  const dayText = dayLabel(form.dayKey, today);

  const meter = useDriverMeter(vehicle ? form.dayKey : undefined);
  const meterFull = Boolean(meter.data && meter.data.used >= meter.data.limit);
  const blockedByMeter = meterFull && (!form.recurring || form.days.includes(weekday));
  const suspended = me?.status === 'suspended';

  const missing = !vehicle
    ? 'Add your car first'
    : !form.from || !form.to
      ? 'Choose where you start and where you finish'
      : corridor.length < 2 || totalKm <= 0
        ? "We couldn't build a route between those places"
        : timeError
          ? 'Pick a departure time in the future'
          : form.recurring && form.days.length === 0
            ? 'Pick at least one day to repeat on'
            : blockedByMeter
              ? `You've already used both trips on ${dayText}`
              : suspended
                ? 'Your account is suspended'
                : null;

  const submit = () => {
    if (missing || !vehicle) return;
    const days = WEEKDAYS.filter((d) => form.days.includes(d));
    publish.mutate(
      {
        vehicleId: vehicle.id,
        departureTime: departure.toISOString(),
        recurringDays: form.recurring ? days : null,
        seatsOffered: seats,
        womenOnly,
        stopPlaceIds: served,
      },
      {
        onSuccess: (trips) => {
          hapticNotify('success');
          const first = trips[0];
          toast.success(
            trips.length > 1 ? `${trips.length} trips published` : 'Trip published',
            `${placeName(served[0]!)} → ${placeName(served[served.length - 1]!)}${first ? ` · ${formatDeparture(first.departureTime)}` : ''}. We'll ping you when someone asks to join.`,
          );
          setForm({ ...defaultForm(me), vehicleId: vehicle.id });
          router.navigate('/my-trip');
        },
        onError: () => hapticNotify('error'),
      },
    );
  };

  // ─── no vehicle ─────────────────────────────────────────────────────────────
  if (!vehicle) {
    return (
      <Screen tabBarSpace>
        <Title />
        <Card style={s.noCar}>
          <View style={s.noCarArt}>
            <CarIllustration color="Silver" width={200} />
          </View>
          <EmptyState
            icon="car-sport"
            title="Add your car to start sharing rides"
            body="Register the car you drive — then publish the trips you already make and share the running cost."
            action={{ label: 'Add your car', icon: 'add', onPress: () => router.push('/vehicle/new') }}
            style={s.noCarEmpty}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen tabBarSpace testID="publish">
      <Title />

      {suspended ? (
        <View style={s.errorBox}>
          <Icon name="alert-circle" size={20} color="coral" />
          <Text variant="caption" color="ink" style={s.flex}>
            Your account is suspended, so you can&apos;t publish trips right now. Contact support if you think this is a mistake.
          </Text>
        </View>
      ) : null}

      {/* 1 · Car */}
      <Step n={1} title="Your car">
        {vehicles.length > 1 ? (
          <View style={s.vehicleList}>
            {vehicles.map((v) => (
              <VehicleOption key={v.id} vehicle={v} selected={v.id === vehicle.id} onPress={() => update({ vehicleId: v.id })} />
            ))}
          </View>
        ) : (
          <VehicleOption vehicle={vehicle} selected />
        )}
        <Pressable onPress={() => router.push('/vehicle/new')} hitSlop={6} style={s.addCar}>
          <Icon name="add-circle-outline" size={16} color="primary" />
          <Text variant="caption" color="primary" style={s.link}>
            Add another car
          </Text>
        </Pressable>
      </Step>

      {/* 2 · Route */}
      <Step n={2} title="Your route" subtitle="Where you're going anyway. We suggest the stops along the way.">
        <Card padding={0}>
          <View style={s.endpoints}>
            <View style={s.endpointRail}>
              <View style={s.dotFrom} />
              <View style={s.endpointLine} />
              <View style={s.dotTo} />
            </View>
            <View style={s.flex}>
              <EndpointRow label="From" placeId={form.from} placeholder="Where do you start?" onPress={() => setSheet('from')} testID="pick-from" />
              <View style={s.hair} />
              <EndpointRow label="To" placeId={form.to} placeholder="Where are you going?" onPress={() => setSheet('to')} testID="pick-to" />
            </View>
            <Pressable
              onPress={() => {
                hapticTap();
                update({ from: form.to, to: form.from, vias: [], skipped: [] });
              }}
              disabled={!form.from && !form.to}
              accessibilityRole="button"
              accessibilityLabel="Swap from and to"
              style={({ pressed }) => [s.swap, pressed ? s.pressed : null]}
              testID="swap"
            >
              <Icon name="swap-vertical" size={20} color="primary" />
            </Pressable>
          </View>

          {form.from && form.to && !suggestion ? (
            <View style={s.routeError}>
              <Icon name="alert-circle-outline" size={16} color="coral" />
              <Text variant="caption" color="coral" style={s.flex}>
                We couldn&apos;t route through those stops without doubling back. Remove a via stop.
              </Text>
            </View>
          ) : null}

          {suggestion ? (
            <Animated.View entering={FadeIn.duration(250)} style={s.corridor} testID="corridor">
              <TripMap
                routeStops={served.map((id) => KIGALI_PLACES.find((p) => p.id === id)!)}
                boardPlaceId={form.from ?? undefined}
                alightPlaceId={form.to ?? undefined}
                height={190}
                interactive={false}
              />
              <View style={s.corridorBody}>
                <View style={s.corridorHead}>
                  <Text variant="label">Stops on your route</Text>
                  <Text variant="caption" color="ink">
                    {formatKm(totalKm)} · {served.length} stops
                  </Text>
                </View>
                <Text variant="caption">Turn off stops where you won&apos;t pick up or drop off.</Text>
                <View>
                  {route.map((id, i) => {
                    const endpoint = i === 0 || i === route.length - 1;
                    const isVia = form.vias.includes(id);
                    const on = endpoint || !form.skipped.includes(id);
                    const km = routeKm.find((c) => c.placeId === id)?.cumulativeKm ?? 0;
                    return (
                      <Animated.View key={id} layout={LinearTransition} entering={FadeInDown.duration(200)}>
                        <CorridorRow
                          id={id}
                          first={i === 0}
                          last={i === route.length - 1}
                          km={km}
                          on={on}
                          endpoint={endpoint}
                          via={isVia}
                          onToggle={() =>
                            update({ skipped: on ? [...form.skipped, id] : form.skipped.filter((x) => x !== id) })
                          }
                          onRemoveVia={() => update({ vias: form.vias.filter((x) => x !== id), skipped: form.skipped.filter((x) => x !== id) })}
                        />
                      </Animated.View>
                    );
                  })}
                </View>
                {suggestion.nearby.length ? (
                  <View style={s.viaBlock}>
                    <Text variant="caption" color="ink" style={s.semi}>
                      Add a via stop
                    </Text>
                    <View style={s.chips}>
                      {[...suggestion.nearby]
                        .sort((a, b) => placeName(a).localeCompare(placeName(b)))
                        .map((id) => (
                          <Chip
                            key={id}
                            label={placeName(id)}
                            icon="add"
                            onPress={() => {
                              const next = [...form.vias, id];
                              if (!suggestCorridor(form.from!, form.to!, next)) {
                                toast.error(`Can't go via ${placeName(id)}`, "That would double back on your route.");
                                return;
                              }
                              hapticTap();
                              update({ vias: next });
                            }}
                          />
                        ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </Card>
      </Step>

      {/* 3 · When */}
      <Step n={3} title="When you leave">
        <Card style={s.gap14}>
          <View style={s.chips}>
            {dayOptions.map((key) => (
              <Chip key={key} label={dayLabel(key, today, true)} selected={key === form.dayKey} onPress={() => update({ dayKey: key })} />
            ))}
          </View>
          <TimeStepper value={form.time} onChange={(time) => update({ time })} minTime={minTime} error={timeError} />
          <View style={s.hair} />
          <ToggleRow
            icon="repeat"
            title="Repeat every week"
            subtitle="For your regular commute — we publish each chosen day for the next 7 days."
            value={form.recurring}
            onChange={(recurring) => update({ recurring })}
            testID="recurring-toggle"
          />
          {form.recurring ? (
            <Animated.View entering={FadeInDown.duration(200)} style={s.gap10}>
              <View style={s.chips}>
                {WORK_DAYS.map((d) => (
                  <Chip
                    key={d}
                    label={WEEKDAY_SHORT[d]}
                    selected={form.days.includes(d)}
                    onPress={() => update({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })}
                  />
                ))}
              </View>
              <Text variant="caption">
                Starting {dayText.toLowerCase() === 'today' || dayText.toLowerCase() === 'tomorrow' ? dayText.toLowerCase() : dayText} at {form.time}. Each day still counts towards the
                two-trip limit.
              </Text>
            </Animated.View>
          ) : null}
        </Card>
        <Card style={s.meterCard} testID="publish-meter">
          {meter.data ? (
            <TwoTripMeter used={meter.data.used} limit={meter.data.limit} dayLabel={dayText === 'Today' || dayText === 'Tomorrow' ? dayText.toLowerCase() : `on ${dayText}`} />
          ) : (
            <Text variant="caption">{meter.isError ? "Couldn't check your trips for that day." : 'Checking your trips for that day…'}</Text>
          )}
          {blockedByMeter ? (
            <View style={s.limitNote} testID="meter-blocked">
              <Icon name="information-circle" size={16} color="accentInk" />
              <Text variant="caption" color="accentInk" style={s.flex}>
                You already have {meter.data?.used} trips on {dayText}. Take Me Home is for trips you already make — up to two a day, one out and one back. Pick another day.
              </Text>
            </View>
          ) : (
            <Text variant="caption">Up to two trips a day — one out, one back.</Text>
          )}
        </Card>
      </Step>

      {/* 4 · Seats & who can join */}
      <Step n={4} title="Seats & who can join">
        <Card style={s.gap14}>
          <View style={s.seatsRow}>
            <View style={s.flex}>
              <Text variant="bodyStrong">Empty seats to offer</Text>
              <Text variant="caption">
                Your {vehicle.make} {vehicle.model} has room for {maxSeats} passenger{maxSeats === 1 ? '' : 's'}.
              </Text>
            </View>
            <NumberStepper value={seats} min={1} max={maxSeats} onChange={(n) => update({ seats: n })} testID="seats" />
          </View>
          <View style={s.hair} />
          <ToggleRow
            icon="female"
            title="Women only"
            subtitle={
              canWomenOnly
                ? 'Only women passengers can see and request this trip.'
                : 'Only women drivers can offer women-only trips. Set your gender in Profile to turn this on.'
            }
            value={womenOnly}
            onChange={(v) => update({ womenOnly: v })}
            disabled={!canWomenOnly}
            testID="women-only-toggle"
          />
          <View style={s.hair} />
          <View style={s.evRow}>
            <View style={[s.evIcon, isEV ? s.evIconOn : null]}>
              <Icon name="flash" size={18} color={isEV ? 'accentInk' : 'ink3'} />
            </View>
            <View style={s.flex}>
              <View style={s.evTitle}>
                <Text variant="bodyStrong">{isEV ? 'Electric / hybrid' : 'Petrol or diesel'}</Text>
                {isEV ? <Badge kind="ev" /> : null}
              </View>
              <Text variant="caption">
                {isEV
                  ? `Your ${vehicle.make} is electric — passengers pay a lower RWF ${BOOKING_FEE_EV} booking fee.`
                  : `Passengers pay the standard RWF ${BOOKING_FEE} booking fee. EV & hybrid trips get a lower RWF ${BOOKING_FEE_EV} fee.`}
              </Text>
            </View>
          </View>
        </Card>
      </Step>

      {/* 5 · Contribution preview */}
      {corridor.length >= 2 && totalKm > 0 ? (
        <Step n={5} title="What passengers contribute" subtitle="Set by the cost-sharing formula — drivers can't set prices.">
          <PricePreview corridor={corridor} nameOf={placeName} seatsOffered={seats} isEV={isEV} />
        </Step>
      ) : null}

      {publish.error ? <PublishError error={publish.error} /> : null}

      <View style={s.submit}>
        <Button
          label={form.recurring ? 'Publish recurring trip' : 'Publish trip'}
          icon="paper-plane"
          size="lg"
          block
          disabled={Boolean(missing)}
          loading={publish.isPending}
          onPress={submit}
          testID="publish-submit"
        />
        {missing ? (
          <Text variant="caption" align="center">
            {missing}
          </Text>
        ) : (
          <Text variant="caption" align="center">
            {formatDeparture(departure)} · {placeName(served[0]!)} → {placeName(served[served.length - 1]!)} · {seats} seat{seats === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      <PlaceSheet
        visible={sheet === 'from'}
        onClose={() => setSheet(null)}
        title="Where do you start?"
        selectedId={form.from}
        disabledId={form.to}
        onSelect={(p) => update({ from: p.id, vias: [], skipped: [] })}
      />
      <PlaceSheet
        visible={sheet === 'to'}
        onClose={() => setSheet(null)}
        title="Where are you going?"
        selectedId={form.to}
        disabledId={form.from}
        onSelect={(p) => update({ to: p.id, vias: [], skipped: [] })}
      />
    </Screen>
  );
}

function safeCorridor(ids: readonly string[]): CorridorStop[] {
  if (ids.length < 2) return [];
  try {
    return buildCorridor(ids);
  } catch {
    return [];
  }
}

function dayLabel(key: string, today: string, short = false): string {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const label = formatDay(`${key}T12:00:00.000Z`);
  return short ? label.replace(/ \w{3}$/, '') : label;
}

function Title() {
  const s = useStyles();
  return (
    <View style={s.title}>
      <Text variant="h1">Publish a trip</Text>
      <Text variant="body" color="ink2">
        Share the trip you&apos;re already making. Passengers on your route request to join and chip in for fuel and wear.
      </Text>
    </View>
  );
}

function Step({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.step}>
      <View style={s.stepHead}>
        <View style={s.stepNum}>
          <Text style={s.stepNumText}>{n}</Text>
        </View>
        <View style={s.flex}>
          <Text variant="h3">{title}</Text>
          {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function VehicleOption({ vehicle, selected, onPress }: { vehicle: Vehicle; selected: boolean; onPress?: () => void }) {
  const s = useStyles();
  return (
    <Card variant={selected && onPress ? 'tinted' : 'elevated'} onPress={onPress} style={[s.vehicle, selected && onPress ? s.vehicleSelected : null]}>
      <CarIllustration color={vehicle.color} width={96} shadow={false} />
      <View style={s.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {vehicle.color} · {vehicle.plate} · {vehicle.seats} seats
        </Text>
        <View style={s.vehicleBadges}>
          {vehicle.isEV ? <Badge kind="ev" /> : null}
          {vehicle.verified ? <Badge kind="success" icon="shield-checkmark" label="Verified" /> : <Badge kind="neutral" label="Not verified yet" />}
        </View>
      </View>
      {onPress ? <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? 'primary' : 'ink3'} /> : null}
    </Card>
  );
}

function EndpointRow({ label, placeId, placeholder, onPress, testID }: { label: string; placeId: string | null; placeholder: string; onPress: () => void; testID?: string }) {
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.endpoint, pressed ? s.pressed : null]} testID={testID}>
      <Text variant="caption">{label}</Text>
      <Text variant={placeId ? 'bodyStrong' : 'body'} color={placeId ? 'ink' : 'ink3'} numberOfLines={1}>
        {placeId ? placeName(placeId) : placeholder}
      </Text>
      {placeId ? (
        <Text variant="caption" numberOfLines={1}>
          {placeLandmark(placeId)}
        </Text>
      ) : null}
    </Pressable>
  );
}

function CorridorRow({
  id,
  first,
  last,
  km,
  on,
  endpoint,
  via,
  onToggle,
  onRemoveVia,
}: {
  id: string;
  first: boolean;
  last: boolean;
  km: number;
  on: boolean;
  endpoint: boolean;
  via: boolean;
  onToggle: () => void;
  onRemoveVia: () => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.cRow} testID={`stop-${id}`}>
      <View style={s.cRail}>
        <View style={[s.cLine, s.cLineTop, first ? s.hidden : null]} />
        <View style={[s.cLine, s.cLineBottom, last ? s.hidden : null]} />
        <View style={[s.cDot, first ? s.cDotFrom : last ? s.cDotTo : on ? s.cDotOn : s.cDotOff]} />
      </View>
      <View style={s.flex}>
        <View style={s.cNameRow}>
          <Text variant={endpoint ? 'bodyStrong' : 'body'} color={on ? 'ink' : 'ink3'} numberOfLines={1} style={s.cName}>
            {placeName(id)}
          </Text>
          {via ? <Badge kind="primary" label="Via" /> : null}
        </View>
        <Text variant="caption" color={on ? 'ink2' : 'ink3'} numberOfLines={1}>
          {endpoint ? placeLandmark(id) : on ? `Pick up & drop off · ${formatKm(km)}` : 'Driving past — no pickups'}
        </Text>
      </View>
      {endpoint ? (
        <View style={s.lock}>
          <Icon name="lock-closed" size={12} color="ink3" />
          <Text variant="caption" color="ink3">
            {first ? 'Start' : 'End'}
          </Text>
        </View>
      ) : via ? (
        <Pressable onPress={onRemoveVia} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${placeName(id)}`} style={s.removeVia}>
          <Icon name="close" size={16} color="ink2" />
        </Pressable>
      ) : (
        <Switch
          value={on}
          onValueChange={() => {
            hapticTap();
            onToggle();
          }}
          trackColor={{ false: colors.line, true: colors.primary }}
          thumbColor={colors.surface}
          {...({ activeThumbColor: colors.surface } as object)}
          accessibilityLabel={`Serve ${placeName(id)}`}
          testID={`toggle-${id}`}
        />
      )}
    </View>
  );
}

function PublishError({ error }: { error: Error }) {
  const s = useStyles();
  const code = error instanceof ApiError ? error.code : null;
  const title =
    code === 'DAILY_TRIP_LIMIT'
      ? "That's already two trips that day"
      : code === 'ACCOUNT_SUSPENDED'
        ? 'Your account is suspended'
        : code === 'WOMEN_ONLY'
          ? "Women-only isn't available"
          : "Couldn't publish your trip";
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={s.errorBox} testID="publish-error">
      <Icon name={code === 'DAILY_TRIP_LIMIT' ? 'calendar' : 'alert-circle'} size={20} color="coral" />
      <View style={s.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="ink">
          {errorMessage(error)}
        </Text>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  semi: { fontFamily: t.fonts.bodySemiBold },
  link: { fontFamily: t.fonts.bodySemiBold },
  pressed: { opacity: 0.6 },
  hidden: { opacity: 0 },
  hair: { height: 1, backgroundColor: t.colors.line },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  title: { marginTop: 12, marginBottom: 8, gap: 6 },
  noCar: { marginTop: 16, gap: 0 },
  noCarArt: { alignItems: 'center', paddingTop: 12 },
  noCarEmpty: { paddingTop: 8 },
  step: { marginTop: 24, gap: 12 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: t.fonts.heading, fontSize: 14, color: t.colors.onPrimary },
  vehicleList: { gap: 10 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: 'transparent' },
  vehicleSelected: { borderColor: t.colors.primary },
  vehicleBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  addCar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  endpoints: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, gap: 12 },
  endpointRail: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 28 },
  dotFrom: { width: 14, height: 14, borderRadius: 7, backgroundColor: t.colors.primary, borderWidth: 3, borderColor: t.colors.tint },
  dotTo: { width: 14, height: 14, borderRadius: 7, backgroundColor: t.colors.accent, borderWidth: 3, borderColor: t.colors.accent2 },
  endpointLine: { flex: 1, width: 2, backgroundColor: t.colors.line, marginVertical: 4 },
  endpoint: { paddingVertical: 14, gap: 1 },
  swap: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  routeError: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: t.colors.line },
  corridor: { borderTopWidth: 1, borderTopColor: t.colors.line },
  corridorBody: { padding: 16, gap: 8 },
  corridorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  cRail: { width: 20, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  cLine: { position: 'absolute', width: 3, left: 8.5, backgroundColor: t.colors.primary, borderRadius: 2 },
  cLineTop: { top: 0, bottom: '50%' },
  cLineBottom: { top: '50%', bottom: 0 },
  cDot: { width: 12, height: 12, borderRadius: 6 },
  cDotFrom: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.primary, borderWidth: 4, borderColor: t.colors.tint },
  cDotTo: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.accent, borderWidth: 4, borderColor: t.colors.accent2 },
  cDotOn: { backgroundColor: t.colors.surface, borderWidth: 3, borderColor: t.colors.primary },
  cDotOff: { backgroundColor: t.colors.surface, borderWidth: 2.5, borderColor: t.colors.line },
  cNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cName: { flexShrink: 1 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: 13, backgroundColor: t.colors.bg },
  removeVia: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.colors.bg, alignItems: 'center', justifyContent: 'center' },
  viaBlock: { gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meterCard: { gap: 10 },
  limitNote: { flexDirection: 'row', gap: 8, backgroundColor: t.colors.accent2, borderRadius: t.radius.sm, padding: 12 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  evIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.bg, alignItems: 'center', justifyContent: 'center' },
  evIconOn: { backgroundColor: t.colors.accent2 },
  evTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: t.colors.coralWash, borderRadius: t.radius.md, padding: 14, marginTop: 20 },
  submit: { marginTop: 24, gap: 8 },
}));
