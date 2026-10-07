import { formatKm, formatRwf, type JoinRequest } from '@tmh/shared';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, interpolateColor, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Avatar, Badge, Button, Stars, Text, toast, VerificationChips } from '@/components';
import { errorMessage } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useAcceptRequest, useDeclineRequest } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';
import { hapticNotify } from './haptics';

const NEW_MS = 3 * 60_000;

/** One incoming request to join: who, where they board/alight, their contribution, Accept / Decline. */
export function JoinRequestCard({ request }: { request: JoinRequest }) {
  const s = useStyles();
  const { colors } = useTheme();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const busy = accept.isPending || decline.isPending;
  const isNew = Date.now() - Date.parse(request.createdAt) < NEW_MS;
  const firstName = request.passenger.name.split(' ')[0] ?? request.passenger.name;

  // A soft amber glow that fades out, so a request arriving in realtime catches the eye.
  const glow = useSharedValue(isNew ? 1 : 0);
  useEffect(() => {
    if (isNew) glow.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 2400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const glowStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(glow.value, [0, 1], [colors.line, colors.accent]) }));

  const onAccept = () =>
    accept.mutate(request.id, {
      onSuccess: () => {
        hapticNotify('success');
        toast.success(`${firstName} is in`, `We've asked ${firstName} to pay ${formatRwf(request.total)} with MoMo to confirm the seat.`);
      },
      onError: (e) => {
        hapticNotify('error');
        toast.error("Couldn't accept", errorMessage(e));
      },
    });

  const onDecline = () =>
    decline.mutate(request.id, {
      onSuccess: () => {
        hapticNotify('warning');
        toast.show({ title: 'Request declined', message: `We'll let ${firstName} know and help them find another ride.` });
      },
      onError: (e) => toast.error("Couldn't decline", errorMessage(e)),
    });

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOutUp.duration(200)} layout={LinearTransition.springify().damping(20)}>
      <Animated.View style={[s.card, glowStyle]} testID={`join-request-${request.id}`}>
        <View style={s.head}>
          <Avatar name={request.passenger.name} photoUrl={request.passenger.photoUrl} size={48} />
          <View style={s.who}>
            <View style={s.nameRow}>
              <Text variant="bodyStrong" numberOfLines={1} style={s.name}>
                {request.passenger.name}
              </Text>
              {isNew ? <Badge kind="warning" label="New" icon="sparkles" /> : null}
            </View>
            {request.passenger.ratingCount > 0 ? (
              <Stars value={request.passenger.ratingAvg} count={request.passenger.ratingCount} showValue size={13} />
            ) : (
              <Text variant="caption">New to Take Me Home</Text>
            )}
          </View>
          <Text variant="caption" color="ink3">
            {formatRelative(request.createdAt)}
          </Text>
        </View>

        <VerificationChips chips={request.passenger.verification} show={['phone', 'email', 'id']} hideNone />

        <View style={s.segment}>
          <View style={s.segmentLeft}>
            <Text variant="caption" color="ink2">
              Rides with you
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {request.boardStop.place.name} → {request.alightStop.place.name} · {formatKm(request.segmentKm)}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              Boards at {request.boardStop.place.landmark}
            </Text>
          </View>
          <View style={s.amount}>
            <Text variant="caption" color="accentInk">
              Contribution
            </Text>
            <Text variant="money" color="accentInk">
              {formatRwf(request.contributionAmount)}
            </Text>
          </View>
        </View>

        <View style={s.actions}>
          <Button
            label="Decline"
            variant="secondary"
            icon="close"
            onPress={onDecline}
            loading={decline.isPending}
            disabled={busy}
            style={s.btn}
            testID={`decline-${request.id}`}
          />
          <Button label="Accept" icon="checkmark" onPress={onAccept} loading={accept.isPending} disabled={busy} style={s.btn} testID={`accept-${request.id}`} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    padding: 16,
    gap: 12,
    ...t.shadows.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.colors.bg, borderRadius: t.radius.sm, padding: 12 },
  segmentLeft: { flex: 1, gap: 2 },
  amount: { alignItems: 'flex-end', backgroundColor: t.colors.accent2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1 },
}));
