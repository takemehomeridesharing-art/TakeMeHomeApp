import { formatRwf, type HistoryItem } from '@tmh/shared';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Card, EmptyState, ErrorState, Icon, LoadingState, Screen, Text, type BadgeKind } from '@/components';
import { formatDeparture, routeLabel } from '@/lib/format';
import { useHistory } from '@/lib/queries';
import { makeStyles } from '@/theme';

const STATUS: Record<string, { label: string; kind: BadgeKind }> = {
  completed: { label: 'Completed', kind: 'success' },
  confirmed: { label: 'Confirmed', kind: 'primary' },
  cancelled: { label: 'Cancelled', kind: 'neutral' },
  no_show: { label: 'No-show', kind: 'neutral' },
  refunded: { label: 'Refunded', kind: 'warning' },
  in_progress: { label: 'On the way', kind: 'primary' },
  published: { label: 'Upcoming', kind: 'primary' },
  full: { label: 'Full', kind: 'primary' },
};

/** Past trips as driver and as passenger. */
export default function HistoryScreen() {
  const s = useStyles();
  const q = useHistory();

  const open = (h: HistoryItem) =>
    h.bookingId ? router.push({ pathname: '/booking/[id]', params: { id: h.bookingId } }) : router.push({ pathname: '/trip/[id]', params: { id: h.trip.id } });

  return (
    <Screen header={{ title: 'Trip history' }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} title="Couldn't load your history" onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon="time-outline" title="No trips yet" body="Trips you ride or drive will be listed here once they're done." action={{ label: 'Find a ride', icon: 'search', onPress: () => router.navigate('/rides') }} />
      ) : (
        <View style={s.list}>
          {q.data.map((h, i) => {
            const st = STATUS[h.status] ?? { label: h.status, kind: 'neutral' as BadgeKind };
            const driver = h.role === 'driver';
            return (
              <Animated.View key={`${h.trip.id}-${h.bookingId ?? h.role}`} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)}>
                <Card onPress={() => open(h)} style={s.card} testID={`history-${i}`}>
                  <View style={[s.roleIcon, driver ? s.roleDriver : null]}>
                    <Icon name={driver ? 'car-sport' : 'person'} size={18} color={driver ? 'onPrimary' : 'primary'} />
                  </View>
                  <View style={s.flex}>
                    <View style={s.badges}>
                      <Badge kind={driver ? 'primary' : 'neutral'} label={driver ? 'Driver' : 'Passenger'} />
                      <Badge kind={st.kind} label={st.label} />
                    </View>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {routeLabel(h.trip.stops)}
                    </Text>
                    <Text variant="caption">{formatDeparture(h.trip.departureTime)}</Text>
                  </View>
                  <View style={s.amountCol}>
                    <Text style={s.amount}>{formatRwf(h.amount)}</Text>
                    <Text variant="caption">{driver ? 'recovered' : 'paid'}</Text>
                  </View>
                </Card>
              </Animated.View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, gap: 3 },
  list: { gap: 10, paddingTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  roleDriver: { backgroundColor: t.colors.primary },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontFamily: t.fonts.heading, fontSize: 15, color: t.colors.accentInk, fontVariant: ['tabular-nums'] },
}));
