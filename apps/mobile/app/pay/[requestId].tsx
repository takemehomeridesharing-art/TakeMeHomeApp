import { formatRwf, type PassengerRequestItem } from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState, ErrorState, fromE164, Icon, isValidLocalPhone, LoadingState, PhoneInput, Screen, Text, toE164 } from '@/components';
import { CarVisual } from '@/features/passenger/CarVisual';
import { DriverRow } from '@/features/passenger/DriverRow';
import { ErrorCard } from '@/features/passenger/ErrorCard';
import { hapticSuccess, hapticWarning } from '@/features/passenger/haptics';
import { firstName } from '@/features/passenger/labels';
import { PulseRings } from '@/features/passenger/PulseRings';
import { formatDeparture, formatPhone } from '@/lib/format';
import { useJoinRequest, useMe, usePayment, usePayRequest } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';

/** Pay an accepted request with (mock) MTN MoMo, presented as a bottom sheet over the request summary. */
export default function PayScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const q = useJoinRequest(requestId);

  if (q.isPending) {
    return (
      <Screen header={{ title: 'Pay with MoMo' }} scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen header={{ title: 'Pay with MoMo' }} scroll={false}>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Screen>
    );
  }
  return <PaySheet item={q.data} />;
}

function PaySheet({ item }: { item: PassengerRequestItem }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { joinRequest: jr, trip } = item;
  const pay = usePayRequest();
  const [phone, setPhone] = useState(me ? fromE164(me.phone) : '');
  const [touched, setTouched] = useState(false);
  // The payment we're watching: one we just started, or one already in flight when the screen opened.
  const [paymentId, setPaymentId] = useState<string | null>(jr.latestPayment?.status === 'initiated' ? jr.latestPayment.id : null);
  const payment = usePayment(paymentId ?? undefined);
  const status = payment.data?.status;
  const bookingId = payment.data?.bookingId ?? jr.bookingId;
  const driver = firstName(trip.driver.name);
  const phoneError = touched && !isValidLocalPhone(phone) ? 'Enter your MTN MoMo number, e.g. 788 123 456' : null;

  useEffect(() => {
    if (status === 'confirmed' && bookingId) {
      hapticSuccess();
      const t = setTimeout(() => router.replace({ pathname: '/booking/[id]', params: { id: bookingId } }), 1100);
      return () => clearTimeout(t);
    }
    if (status === 'failed') hapticWarning();
  }, [status, bookingId]);

  // Already paid (e.g. reopened from history): straight to the ticket.
  useEffect(() => {
    if (!paymentId && jr.bookingId) router.replace({ pathname: '/booking/[id]', params: { id: jr.bookingId } });
  }, [paymentId, jr.bookingId]);

  const start = () => {
    setTouched(true);
    if (!isValidLocalPhone(phone)) return;
    pay.mutate({ requestId: jr.id, msisdn: toE164(phone) }, { onSuccess: (p) => setPaymentId(p.id) });
  };

  const retry = () => {
    pay.reset();
    setPaymentId(null);
  };

  const phase: 'form' | 'waiting' | 'confirmed' | 'failed' =
    status === 'confirmed' ? 'confirmed' : status === 'failed' ? 'failed' : status === 'initiated' ? 'waiting' : 'form';
  const notPayable = jr.status !== 'accepted' && !jr.bookingId;

  return (
    <Screen header={{ title: 'Confirm your seat' }} padding={0} contentStyle={s.content}>
      <Animated.View entering={FadeIn.duration(250)} style={s.summary}>
        <Card style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View style={s.flex}>
              <Text variant="label">{formatDeparture(trip.departureTime)}</Text>
              <Text variant="h2">
                {jr.boardStop.place.name} → {jr.alightStop.place.name}
              </Text>
              <Text variant="caption">
                {trip.vehicle.color} {trip.vehicle.make} {trip.vehicle.model} · {trip.vehicle.plate}
              </Text>
            </View>
            <View style={s.carBox}>
              <CarVisual vehicle={trip.vehicle} width={84} height={40} />
            </View>
          </View>
          <View style={s.hr} />
          <DriverRow user={trip.driver} right={<Badge kind="success" icon="checkmark-circle" label="Accepted" />} />
        </Card>
        <View style={s.secure}>
          <Icon name="shield-checkmark-outline" size={14} color="ink2" />
          <Text variant="caption">You only pay once {driver} has accepted. Full refund if the trip is cancelled.</Text>
        </View>
      </Animated.View>

      <View style={s.spacer} />

      <Animated.View entering={FadeInUp.duration(320)} style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={s.handle} />
        <View style={s.brandRow}>
          <View style={s.momo}>
            <Text style={s.momoText}>MoMo</Text>
          </View>
          <View style={s.flex}>
            <Text variant="h3">MTN Mobile Money</Text>
            <Text variant="caption">Your cost share for this seat</Text>
          </View>
          <Text style={s.headerAmount}>{formatRwf(jr.total)}</Text>
        </View>

        {notPayable ? (
          <EmptyState
            icon="hourglass-outline"
            title="Not ready for payment"
            body={jr.status === 'pending' ? `You can pay once ${driver} accepts your request.` : 'This request is no longer active.'}
            action={{ label: 'Back to request', onPress: () => router.back() }}
          />
        ) : phase === 'form' ? (
          <View style={s.phase}>
            <PhoneInput label="MoMo number" value={phone} onChangeText={setPhone} error={phoneError} hint="We'll send the payment prompt to this phone" testID="momo-phone" />
            <View style={s.breakdown}>
              <Row label={`Cost share · ${jr.segmentKm.toFixed(1)} km`} value={formatRwf(jr.contributionAmount)} />
              <Row label={trip.isEV ? 'Booking fee · EV rate' : 'Booking fee'} value={formatRwf(jr.bookingFee)} />
              <View style={s.divider} />
              <View style={s.totalRow}>
                <Text variant="bodyStrong">Total</Text>
                <Text style={s.total}>{formatRwf(jr.total)}</Text>
              </View>
            </View>
            {pay.error ? <ErrorCard error={pay.error} fallbackTitle="Couldn't start the payment" /> : null}
            <Button label={`Pay ${formatRwf(jr.total)} with MoMo`} icon="lock-closed" size="lg" block loading={pay.isPending} onPress={start} testID="pay-with-momo" />
            <Text variant="caption" align="center">
              {formatRwf(jr.contributionAmount)} goes to {driver} for fuel and wear. The booking fee keeps Take Me Home running.
            </Text>
          </View>
        ) : phase === 'waiting' ? (
          <Animated.View entering={FadeIn.duration(250)} style={[s.phase, s.center]} testID="momo-waiting">
            <PulseRings icon="phone-portrait-outline" tone="accent" size={76} />
            <Text variant="h2" align="center">
              Check your phone
            </Text>
            <Text variant="body" color="ink2" align="center">
              Approve the MoMo prompt (*182#) for <Text variant="bodyStrong">{formatRwf(jr.total)}</Text> on {formatPhone(payment.data?.msisdn ?? toE164(phone))}.
            </Text>
            <View style={s.waitingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption">Waiting for MTN MoMo…</Text>
            </View>
            <Text variant="caption" align="center">
              No prompt? Dial *182*7# to see pending approvals.
            </Text>
          </Animated.View>
        ) : phase === 'confirmed' ? (
          <Animated.View entering={ZoomIn.springify()} style={[s.phase, s.center]} testID="momo-confirmed">
            <PulseRings icon="checkmark" tone="success" size={76} active={false} />
            <Text variant="h2" align="center">
              Payment received
            </Text>
            <Text variant="body" color="ink2" align="center">
              Your seat is confirmed. Opening your ticket…
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={[s.phase, s.center]} testID="momo-failed">
            <PulseRings icon="close" tone="coral" size={76} active={false} />
            <Text variant="h2" align="center">
              Payment didn&apos;t go through
            </Text>
            <Text variant="body" color="ink2" align="center">
              {sentence(payment.data?.failureReason) ?? 'The MoMo prompt was declined or timed out.'} You haven&apos;t been charged.
            </Text>
            <Button label="Try again" icon="refresh" size="lg" block onPress={retry} testID="momo-retry" />
          </Animated.View>
        )}
      </Animated.View>
    </Screen>
  );
}

/** `Payer declined the MoMo prompt` → `Payer declined the MoMo prompt.` */
function sentence(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  return /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

function Row({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text variant="body" color="ink2">
        {label}
      </Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  content: { paddingBottom: 0 },
  summary: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  summaryCard: { gap: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carBox: { width: 92, height: 52, borderRadius: t.radius.sm, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  hr: { height: 1, backgroundColor: t.colors.line },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  spacer: { flex: 1, minHeight: 24 },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 18,
    ...t.shadows.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.line },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  momo: { width: 48, height: 48, borderRadius: 14, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' },
  momoText: { fontFamily: t.fonts.headingHeavy, fontSize: 13, color: t.colors.ink, letterSpacing: -0.2 },
  headerAmount: { fontFamily: t.fonts.headingHeavy, fontSize: 18, color: t.colors.accentInk, fontVariant: ['tabular-nums'] },
  phase: { gap: 14 },
  center: { alignItems: 'center', paddingVertical: 8 },
  breakdown: { backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontFamily: t.fonts.heading, fontSize: 15, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: t.colors.line },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontFamily: t.fonts.headingHeavy, fontSize: 24, lineHeight: 30, color: t.colors.ink, fontVariant: ['tabular-nums'] },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));
