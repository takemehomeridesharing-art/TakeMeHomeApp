import { REPORT_REASONS, type ReportReason } from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Avatar, Button, Card, Chip, EmptyState, Input, ListRow, LoadingState, Screen, Text, toast } from '@/components';
import { ConfirmSheet } from '@/features/passenger/ConfirmSheet';
import { ErrorCard } from '@/features/passenger/ErrorCard';
import { hapticSelect, hapticSuccess } from '@/features/passenger/haptics';
import { firstName, REPORT_REASON_LABELS } from '@/features/passenger/labels';
import { PulseRings } from '@/features/passenger/PulseRings';
import { formatDeparture } from '@/lib/format';
import { useBlockUser, useBooking, useBlocks, useCreateReport, useMyBookings, useUser } from '@/lib/queries';
import { makeStyles } from '@/theme';

/** Report an issue about a booking and/or a person, and optionally block them. */
export default function ReportScreen() {
  const s = useStyles();
  const params = useLocalSearchParams<{ bookingId?: string; userId?: string }>();
  const [pickedBooking, setPickedBooking] = useState<string | null>(null);
  const bookingId = params.bookingId || pickedBooking || undefined;
  const booking = useBooking(bookingId);
  const counterpart = booking.data ? (booking.data.viewerRole === 'passenger' ? booking.data.driver : booking.data.passenger) : null;
  const userId = params.userId || counterpart?.id;
  const user = useUser(params.userId || undefined, { enabled: Boolean(params.userId) && !counterpart });
  const person = counterpart ?? user.data ?? null;
  const myBookings = useMyBookings({ enabled: !params.bookingId && !params.userId });
  const blocks = useBlocks();
  const report = useCreateReport();
  const block = useBlockUser();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const alreadyBlocked = Boolean(userId && blocks.data?.some((b) => b.user.id === userId));
  const bodyError = touched && body.trim().length < 5 ? 'Tell us a little more (5+ characters)' : null;
  const hasTarget = Boolean(bookingId || userId);

  const submit = () => {
    setTouched(true);
    if (!reason || body.trim().length < 5 || !hasTarget) return;
    report.mutate(
      { reason, body: body.trim(), bookingId, reportedUserId: userId },
      {
        onSuccess: () => {
          hapticSuccess();
          setSent(true);
        },
      },
    );
  };

  const doBlock = () => {
    if (!userId) return;
    block.mutate(userId, {
      onSuccess: () => {
        setConfirmBlock(false);
        toast.success(`${person ? firstName(person.name) : 'They'} can't contact you now`, 'You won’t see each other’s trips.');
      },
    });
  };

  const blockCard =
    person && userId ? (
      <Card style={s.card}>
        <ListRow
          icon="ban"
          iconColor="coral"
          title={alreadyBlocked ? `You blocked ${firstName(person.name)}` : `Block ${firstName(person.name)}`}
          subtitle={alreadyBlocked ? 'Manage blocked people in Profile' : 'You won’t see each other’s trips or be able to message'}
          onPress={alreadyBlocked ? () => router.push('/blocked') : () => setConfirmBlock(true)}
        />
      </Card>
    ) : null;

  const confirmBlockSheet = (
    <ConfirmSheet
      visible={confirmBlock}
      onClose={() => setConfirmBlock(false)}
      title={`Block ${person ? firstName(person.name) : 'this person'}?`}
      subtitle="You won't see each other's trips, requests or messages. They aren't told."
      confirmLabel="Block"
      confirmIcon="ban"
      confirmVariant="danger"
      cancelLabel="Cancel"
      loading={block.isPending}
      onConfirm={doBlock}
      testID="confirm-block"
    >
      {block.error ? <ErrorCard error={block.error} fallbackTitle="Couldn't block" /> : null}
    </ConfirmSheet>
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (sent) {
    return (
      <Screen header={{ title: 'Report an issue', back: false, right: null }} footer={<Button label="Done" size="lg" block onPress={close} testID="report-done" />}>
        <Animated.View entering={ZoomIn.springify()} style={s.sent} testID="report-sent">
          <PulseRings icon="shield-checkmark" tone="primary" active={false} />
          <Text variant="h1" align="center">
            Thanks — we&apos;re on it
          </Text>
          <Text variant="body" color="ink2" align="center" style={s.sentBody}>
            Our safety team reviews every report, usually within a few hours. We may message you for details. If you are in danger, call 112.
          </Text>
        </Animated.View>
        {blockCard}
        {confirmBlockSheet}
      </Screen>
    );
  }

  return (
    <Screen
      header={{ title: 'Report an issue' }}
      footer={
        hasTarget ? (
          <>
            {report.error ? <ErrorCard error={report.error} fallbackTitle="Couldn't send your report" /> : null}
            <Button label="Send report" icon="send" variant="danger" size="lg" block disabled={!reason} loading={report.isPending} onPress={submit} testID="report-submit" />
          </>
        ) : undefined
      }
    >
      <Text variant="body" color="ink2" style={s.intro}>
        Tell us what happened. Reports are private — the other person isn&apos;t told who reported them.
      </Text>

      {!hasTarget ? (
        myBookings.isPending ? (
          <LoadingState fill={false} />
        ) : (myBookings.data ?? []).length === 0 ? (
          <EmptyState icon="flag-outline" title="Which trip is this about?" body="Reports are linked to a trip or a person. Open a ticket and tap Report an issue — or email safety@takemehome.rw." />
        ) : (
          <Card padding={8} style={s.card}>
            <Text variant="label" style={s.pickLabel}>
              Which trip is this about?
            </Text>
            {myBookings.data!.slice(0, 8).map((b, i, arr) => (
              <ListRow
                key={b.id}
                icon="car-outline"
                title={`${b.boardStop.place.name} → ${b.alightStop.place.name}`}
                subtitle={`${formatDeparture(b.trip.departureTime)} · ${b.tripCode} · ${b.viewerRole === 'passenger' ? b.driver.name : b.passenger.name}`}
                onPress={() => setPickedBooking(b.id)}
                divider={i < arr.length - 1}
                style={s.pickRow}
              />
            ))}
          </Card>
        )
      ) : (
        <>
          {person || booking.data ? (
            <Card style={[s.card, s.target]}>
              {person ? <Avatar name={person.name} photoUrl={person.photoUrl} size={44} /> : null}
              <View style={s.flex}>
                <Text variant="bodyStrong">{person ? person.name : 'This trip'}</Text>
                {booking.data ? (
                  <Text variant="caption">
                    {booking.data.tripCode} · {booking.data.boardStop.place.name} → {booking.data.alightStop.place.name}
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : null}

          <Text variant="label" style={s.label}>
            What happened?
          </Text>
          <View style={s.reasons}>
            {REPORT_REASONS.map((r) => (
              <Chip
                key={r}
                label={REPORT_REASON_LABELS[r].label}
                icon={REPORT_REASON_LABELS[r].icon}
                selected={reason === r}
                onPress={() => {
                  hapticSelect();
                  setReason(r);
                }}
              />
            ))}
          </View>
          {touched && !reason ? (
            <Text variant="caption" color="coral" style={s.reasonError}>
              Pick what best describes it
            </Text>
          ) : null}

          <Input
            label="Details"
            value={body}
            onChangeText={setBody}
            placeholder="What happened, when and where? Anything that helps us look into it."
            multiline
            maxLength={2000}
            error={bodyError}
            style={s.body}
            containerStyle={s.bodyWrap}
            testID="report-body"
          />

          {blockCard}
        </>
      )}
      {confirmBlockSheet}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  intro: { marginTop: 4, marginBottom: 16 },
  card: { marginBottom: 14 },
  target: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { marginBottom: 10 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  reasonError: { marginBottom: 8 },
  body: { minHeight: 120, textAlignVertical: 'top' },
  bodyWrap: { marginTop: 10, marginBottom: 16 },
  pickLabel: { paddingHorizontal: 8, paddingTop: 8 },
  pickRow: { paddingHorizontal: 8 },
  sent: { alignItems: 'center', gap: 12, paddingTop: 32, paddingBottom: 24 },
  sentBody: { maxWidth: 320 },
}));
