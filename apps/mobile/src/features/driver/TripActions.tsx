import { formatRwf, type TripDetail } from '@tmh/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text, toast } from '@/components';
import { errorMessage } from '@/lib/api';
import { formatDeparture } from '@/lib/format';
import { useCancelTrip, useCompleteTrip, useStartTrip } from '@/lib/queries';
import { makeStyles } from '@/theme';
import { ConfirmSheet } from './ConfirmSheet';
import { hapticNotify } from './haptics';

type Pending = 'start' | 'complete' | 'cancel' | null;

export interface TripActionsProps {
  trip: TripDetail;
  /** Called after the trip was completed (e.g. to open the trip screen for ratings). */
  onCompleted?: (trip: TripDetail) => void;
  /** Called after a cancel. */
  onCancelled?: (trip: TripDetail) => void;
}

/** Start → Complete (and Cancel) for a driver's trip, each behind a confirmation sheet. */
export function TripActions({ trip, onCompleted, onCancelled }: TripActionsProps) {
  const s = useStyles();
  const [sheet, setSheet] = useState<Pending>(null);
  const start = useStartTrip();
  const complete = useCompleteTrip();
  const cancel = useCancelTrip();

  const paid = (trip.passengers ?? []).filter((p) => p.status === 'confirmed');
  const pending = (trip.joinRequests ?? []).filter((jr) => jr.status === 'pending');
  const unpaid = (trip.joinRequests ?? []).filter((jr) => jr.status === 'accepted' && !jr.bookingId);
  const paidShares = paid.reduce((sum, p) => sum + p.contributionAmount, 0);

  // The API only lets a driver start shortly before departure; re-check every 30 s while waiting.
  const startAt = trip.startableFrom ? Date.parse(trip.startableFrom) : null;
  const [now, setNow] = useState(() => Date.now());
  const tooEarly = startAt !== null && now < startAt;
  useEffect(() => {
    if (!tooEarly) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [tooEarly]);

  if (trip.status === 'completed' || trip.status === 'cancelled') return null;

  const close = () => setSheet(null);

  const doStart = () =>
    start.mutate(trip.id, {
      onSuccess: () => {
        hapticNotify('success');
        close();
        toast.success(
          'Trip started',
          paid.length ? `We've told ${paid.length === 1 ? 'your passenger' : `your ${paid.length} passengers`} you're on the way.` : 'Drive safe!',
        );
      },
      onError: (e) => toast.error("Couldn't start the trip", errorMessage(e)),
    });

  const doComplete = () =>
    complete.mutate(trip.id, {
      onSuccess: (done) => {
        hapticNotify('success');
        close();
        toast.success(
          'Trip completed',
          done.ledger ? `${formatRwf(done.ledger.recovered)} recovered towards your ${formatRwf(done.ledger.tripCost)} running cost.` : undefined,
        );
        onCompleted?.(done);
      },
      onError: (e) => toast.error("Couldn't complete the trip", errorMessage(e)),
    });

  const doCancel = () =>
    cancel.mutate(trip.id, {
      onSuccess: (done) => {
        hapticNotify('warning');
        close();
        toast.show({
          title: 'Trip cancelled',
          message: paid.length ? 'Paid passengers are being refunded in full.' : undefined,
        });
        onCancelled?.(done);
      },
      onError: (e) => toast.error("Couldn't cancel the trip", errorMessage(e)),
    });

  return (
    <View style={s.wrap}>
      {trip.status === 'in_progress' ? (
        <>
          <View style={s.live}>
            <View style={s.liveDot} />
            <Text variant="bodyStrong" color="success">
              You&apos;re on the road
            </Text>
          </View>
          <Button label="Complete trip" icon="flag" size="lg" block onPress={() => setSheet('complete')} testID="complete-trip" />
        </>
      ) : (
        <>
          <Button label="Start trip" icon="play" size="lg" block disabled={tooEarly} onPress={() => setSheet('start')} testID="start-trip" />
          {tooEarly && trip.startableFrom ? (
            <View style={s.hint} testID="start-too-early">
              <Icon name="time-outline" size={16} color="ink2" />
              <Text variant="caption" style={s.hintText}>
                You can start from {formatDeparture(trip.startableFrom)} — shortly before you leave.
              </Text>
            </View>
          ) : null}
          <Button label="Cancel trip" variant="ghost" icon="close-circle-outline" block onPress={() => setSheet('cancel')} testID="cancel-trip" />
        </>
      )}

      <ConfirmSheet
        visible={sheet === 'start'}
        onClose={close}
        icon="play"
        title="Start the trip?"
        body={
          paid.length
            ? `We'll tell ${paid.length === 1 ? 'your paid passenger' : `your ${paid.length} paid passengers`} you're on the way. Check each trip code as they board.`
            : 'Nobody has paid for a seat yet — you can still start and drive as planned.'
        }
        confirmLabel="Start trip"
        loading={start.isPending}
        onConfirm={doStart}
        testID="start-sheet"
      >
        {pending.length || unpaid.length ? (
          <Note icon="time">
            {[
              pending.length ? `${pending.length} unanswered request${pending.length === 1 ? '' : 's'}` : null,
              unpaid.length ? `${unpaid.length} unpaid seat${unpaid.length === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' and ')}{' '}
            will lapse when you leave.
          </Note>
        ) : null}
      </ConfirmSheet>

      <ConfirmSheet
        visible={sheet === 'complete'}
        onClose={close}
        icon="flag"
        title="Everyone dropped off?"
        body={
          paidShares
            ? `Completing sends the ${formatRwf(paidShares)} your passengers contributed to your MoMo, towards the ${formatRwf(trip.ledger?.tripCost ?? 0)} this trip cost to run. Then you can rate each passenger.`
            : 'Completing closes the trip. Thanks for offering your empty seats!'
        }
        confirmLabel="Complete trip"
        loading={complete.isPending}
        onConfirm={doComplete}
        testID="complete-sheet"
      />

      <ConfirmSheet
        visible={sheet === 'cancel'}
        onClose={close}
        icon="close-circle"
        tone="danger"
        title="Cancel this trip?"
        body="Only cancel if you're no longer making this journey. Passengers rely on you to get home."
        confirmLabel="Cancel trip"
        cancelLabel="Keep the trip"
        loading={cancel.isPending}
        onConfirm={doCancel}
        testID="cancel-sheet"
      >
        <Note icon="return-down-back">
          {paid.length
            ? `${paid.length} paid passenger${paid.length === 1 ? ' gets' : 's get'} a full refund — contribution and booking fee — straight back to MoMo. `
            : 'Nobody has paid yet, so there is nothing to refund. '}
          {pending.length + unpaid.length ? 'Open requests are closed and those passengers are told to search again.' : ''}
        </Note>
      </ConfirmSheet>
    </View>
  );
}

function Note({ icon, children }: { icon: 'time' | 'return-down-back'; children: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.note}>
      <Icon name={icon} size={16} color="accentInk" />
      <Text variant="caption" color="accentInk" style={s.noteText}>
        {children}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  hintText: { flexShrink: 1 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 6,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.colors.success,
    borderWidth: 3,
    borderColor: t.colors.mint,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: t.colors.accent2,
    borderRadius: t.radius.sm,
    padding: 12,
    marginTop: 4,
  },
  noteText: { flex: 1 },
}));
