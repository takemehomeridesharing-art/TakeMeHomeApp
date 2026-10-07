import { type Notification } from '@tmh/shared';
import { type Href, router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState, ErrorState, Icon, LoadingState, Screen, Text, type IconName } from '@/components';
import { formatRelative } from '@/lib/format';
import { useMarkRead, useNotifications } from '@/lib/queries';
import { makeStyles, useTheme, type ColorTokens } from '@/theme';

const KIND: Record<string, { icon: IconName; color: keyof ColorTokens; bg: keyof ColorTokens }> = {
  join_request: { icon: 'person-add', color: 'primary', bg: 'tint' },
  request_accepted: { icon: 'checkmark-circle', color: 'success', bg: 'mint' },
  booking_confirmed: { icon: 'ticket', color: 'success', bg: 'mint' },
  request_declined: { icon: 'close-circle', color: 'ink2', bg: 'bg' },
  request_cancelled: { icon: 'remove-circle', color: 'ink2', bg: 'bg' },
  request_expired: { icon: 'hourglass', color: 'ink2', bg: 'bg' },
  payment_failed: { icon: 'alert-circle', color: 'coral', bg: 'coralWash' },
  payment_refunded: { icon: 'wallet', color: 'accentInk', bg: 'accent2' },
  trip_cancelled: { icon: 'alert-circle', color: 'coral', bg: 'coralWash' },
  trip_started: { icon: 'navigate', color: 'primary', bg: 'tint' },
  rate_trip: { icon: 'star', color: 'accentInk', bg: 'accent2' },
  rate_passengers: { icon: 'star', color: 'accentInk', bg: 'accent2' },
  rated: { icon: 'star', color: 'accentInk', bg: 'accent2' },
  no_show: { icon: 'eye-off', color: 'ink2', bg: 'bg' },
};
const FALLBACK = { icon: 'notifications' as IconName, color: 'primary' as keyof ColorTokens, bg: 'tint' as keyof ColorTokens };

/** Notification centre: newest first, unread dot, tap to open (and mark read), mark all read. */
export default function NotificationsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const q = useNotifications();
  const markRead = useMarkRead();
  const list = q.data ?? [];
  const unread = list.filter((n) => !n.readAt).length;

  const open = (n: Notification) => {
    if (!n.readAt) markRead.mutate([n.id]);
    if (n.href) router.push(n.href as Href);
  };

  return (
    <Screen
      header={{
        title: 'Notifications',
        subtitle: unread ? `${unread} unread` : undefined,
        right: unread ? (
          <Pressable onPress={() => markRead.mutate(undefined)} hitSlop={8} accessibilityRole="button" testID="mark-all-read">
            <Text variant="caption" color="primary" style={s.markAll}>
              Read all
            </Text>
          </Pressable>
        ) : undefined,
      }}
      scroll={false}
      padding={0}
    >
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} title="Couldn't load notifications" onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[s.list, list.length === 0 ? s.grow : null]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="You're all caught up" body="Updates about your requests, payments and trips will show up here." />}
          renderItem={({ item: n, index }) => {
            const k = KIND[n.type] ?? FALLBACK;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(220)}>
                <Pressable onPress={() => open(n)} accessibilityRole="button" style={({ pressed }) => [s.item, !n.readAt ? s.unread : null, pressed ? s.pressed : null]} testID={`notification-${index}`}>
                  <View style={[s.icon, { backgroundColor: colors[k.bg] }]}>
                    <Icon name={k.icon} size={20} color={k.color} />
                  </View>
                  <View style={s.texts}>
                    <View style={s.titleRow}>
                      <Text variant="bodyStrong" style={s.flex} numberOfLines={2}>
                        {n.title}
                      </Text>
                      <Text variant="caption" color="ink3">
                        {formatRelative(n.createdAt)}
                      </Text>
                    </View>
                    <Text variant="caption" numberOfLines={3}>
                      {n.body}
                    </Text>
                  </View>
                  {!n.readAt ? <View style={s.dot} accessibilityLabel="Unread" /> : null}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  list: { padding: 16, gap: 8 },
  markAll: { fontFamily: t.fonts.bodyBold },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: t.radius.md, backgroundColor: t.colors.surface, ...t.shadows.sm },
  unread: { backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.tint },
  pressed: { opacity: 0.8 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.primary, marginTop: 6 },
}));
