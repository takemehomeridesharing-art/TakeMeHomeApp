import { formatRwf, type TripDetail } from '@tmh/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Avatar, Badge, Button, Icon, Text, toast } from '@/components';
import { errorMessage } from '@/lib/api';
import { useNoShow } from '@/lib/queries';
import { makeStyles } from '@/theme';
import { ConfirmSheet } from './ConfirmSheet';
import { hapticNotify } from './haptics';

type Passenger = NonNullable<TripDetail['passengers']>[number];

interface Row {
  key: string;
  name: string;
  photoUrl: string | null;
  board: string;
  alight: string;
  contribution: number;
  state: 'paid' | 'paying' | 'awaiting' | 'completed' | 'no_show' | 'refunded';
  tripCode?: string;
  booking?: Passenger;
}

/** Accepted passengers, paid or awaiting payment, with board points and contributions. */
export function PassengerList({ trip, emptyText }: { trip: TripDetail; emptyText?: string }) {
  const s = useStyles();
  const rows = passengerRows(trip);
  if (rows.length === 0) {
    return (
      <View style={s.empty}>
        <Icon name="people-outline" size={20} color="ink3" />
        <Text variant="caption" style={s.emptyText}>
          {emptyText ?? 'No passengers yet. Accepted requests show up here until they pay.'}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.list}>
      {rows.map((r, i) => (
        <PassengerRow key={r.key} row={r} trip={trip} divider={i < rows.length - 1} />
      ))}
    </View>
  );
}

export function passengerRows(trip: TripDetail): Row[] {
  const paid: Row[] = (trip.passengers ?? []).map((p) => ({
    key: p.bookingId,
    name: p.passenger.name,
    photoUrl: p.passenger.photoUrl,
    board: p.boardStop.place.name,
    alight: p.alightStop.place.name,
    contribution: p.contributionAmount,
    state: p.status === 'confirmed' ? 'paid' : p.status,
    tripCode: p.tripCode,
    booking: p,
  }));
  const awaiting: Row[] = (trip.joinRequests ?? [])
    .filter((jr) => jr.status === 'accepted' && !jr.bookingId)
    .map((jr) => ({
      key: jr.id,
      name: jr.passenger.name,
      photoUrl: jr.passenger.photoUrl,
      board: jr.boardStop.place.name,
      alight: jr.alightStop.place.name,
      contribution: jr.contributionAmount,
      state: jr.latestPayment?.status === 'initiated' ? 'paying' : 'awaiting',
    }));
  return [...paid, ...awaiting];
}

const STATE_BADGE: Record<
  Row['state'],
  {
    kind: 'success' | 'warning' | 'primary' | 'danger' | 'neutral';
    label: string;
    icon: 'checkmark-circle' | 'time' | 'phone-portrait' | 'flag' | 'return-down-back' | 'checkmark-done';
  }
> = {
  paid: { kind: 'success', label: 'Paid', icon: 'checkmark-circle' },
  paying: { kind: 'primary', label: 'Paying now…', icon: 'phone-portrait' },
  awaiting: { kind: 'warning', label: 'Awaiting payment', icon: 'time' },
  completed: { kind: 'success', label: 'Dropped off', icon: 'checkmark-done' },
  no_show: { kind: 'danger', label: 'No-show', icon: 'flag' },
  refunded: { kind: 'neutral', label: 'Refunded', icon: 'return-down-back' },
};

function PassengerRow({ row, trip, divider }: { row: Row; trip: TripDetail; divider: boolean }) {
  const s = useStyles();
  const noShow = useNoShow();
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const badge = STATE_BADGE[row.state];
  const b = row.booking;
  const canNoShow = Boolean(b && trip.status === 'in_progress' && b.status === 'confirmed');
  const canRate = Boolean(b && trip.status === 'completed' && b.status === 'completed' && !b.driverRated);
  const firstName = row.name.split(' ')[0] ?? row.name;

  return (
    <Animated.View entering={FadeIn.duration(250)} layout={LinearTransition} style={[s.row, divider ? s.divider : null]} testID={`passenger-${row.key}`}>
      <View style={s.head}>
        <Avatar name={row.name} photoUrl={row.photoUrl} size={44} />
        <View style={s.who}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {row.name}
          </Text>
          <View style={s.boardRow}>
            <Icon name="location" size={13} color="primary" />
            <Text variant="caption" numberOfLines={2} style={s.flex}>
              Boards at {row.board} → {row.alight}
            </Text>
          </View>
        </View>
        <View style={s.right}>
          <Text variant="money" color={row.state === 'paid' || row.state === 'completed' ? 'accentInk' : 'ink2'} style={s.money}>
            {formatRwf(row.contribution)}
          </Text>
          <Badge kind={badge.kind} label={badge.label} icon={badge.icon} />
        </View>
      </View>

      {row.tripCode || canNoShow || canRate || b ? (
        <View style={s.footer}>
          {row.tripCode ? (
            <View style={s.code}>
              <Text variant="caption" color="ink2">
                Trip code
              </Text>
              <Text style={s.codeText}>{row.tripCode}</Text>
            </View>
          ) : (
            <View style={s.flex} />
          )}
          <View style={s.actions}>
            {b?.passengerPhone ? (
              <Button label="Call" size="sm" variant="ghost" icon="call-outline" onPress={() => void Linking.openURL(`tel:${b.passengerPhone}`)} testID={`call-${row.key}`} />
            ) : null}
            {b && b.status === 'confirmed' ? (
              <Button label="Message" size="sm" variant="ghost" icon="chatbubble-ellipses-outline" onPress={() => router.push(`/chat/${b.bookingId}`)} />
            ) : null}
            {canNoShow ? (
              <Button label="No-show" size="sm" variant="secondary" icon="flag-outline" onPress={() => setConfirmNoShow(true)} testID={`no-show-${row.key}`} />
            ) : null}
            {canRate ? (
              <Button label="Rate passenger" size="sm" icon="star" onPress={() => router.push(`/rate/${b!.bookingId}`)} testID={`rate-${row.key}`} />
            ) : null}
            {b && trip.status === 'completed' && b.driverRated ? <Badge kind="neutral" icon="star" label="Rated" /> : null}
          </View>
        </View>
      ) : null}

      <ConfirmSheet
        visible={confirmNoShow}
        onClose={() => setConfirmNoShow(false)}
        title={`Mark ${firstName} as a no-show?`}
        body={`Only do this if ${firstName} wasn't at ${row.board} when you passed. We'll let ${firstName} know, and they can report it if it's a mistake.`}
        icon="flag"
        confirmLabel="Mark no-show"
        tone="danger"
        loading={noShow.isPending}
        onConfirm={() =>
          b &&
          noShow.mutate(b.bookingId, {
            onSuccess: () => {
              hapticNotify('warning');
              setConfirmNoShow(false);
              toast.show({ title: `${firstName} marked as a no-show` });
            },
            onError: (e) => toast.error("Couldn't mark no-show", errorMessage(e)),
          })
        }
      />
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  list: {},
  row: { paddingVertical: 12, gap: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flex: 1, gap: 2 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  money: { fontSize: 16, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 8,
    paddingLeft: 56,
  },
  code: { flexGrow: 1, minWidth: 96, gap: 0 },
  codeText: {
    fontFamily: t.fonts.heading,
    fontSize: 15,
    letterSpacing: 1,
    color: t.colors.ink,
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    flexGrow: 1,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  emptyText: { flex: 1 },
}));
