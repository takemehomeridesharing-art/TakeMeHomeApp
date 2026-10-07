import { kigaliDayKey, kigaliTime, type ChatMessage } from '@tmh/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Avatar, Chip, ErrorState, Header, Icon, Input, LoadingState, Screen, Text, toast } from '@/components';
import { firstName } from '@/features/passenger/labels';
import { errorMessage } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { qk, useBooking, useMessages, useSendMessage } from '@/lib/queries';
import { useSession } from '@/stores/session';
import { makeStyles } from '@/theme';

const QUICK_REPLIES = ["I'm at the pick-up point", 'Running 5 minutes late', 'On my way!', 'Thank you!'];

/** In-app chat for one booking (passenger ↔ driver). Realtime via `chat:message` (RealtimeBridge). */
export default function ChatScreen() {
  const s = useStyles();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const client = useQueryClient();
  const meId = useSession((st) => st.me?.id);
  const booking = useBooking(bookingId);
  const messages = useMessages(bookingId);
  const send = useSendMessage();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const other = booking.data ? (booking.data.viewerRole === 'passenger' ? booking.data.driver : booking.data.passenger) : null;
  const list = messages.data ?? [];

  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [list.length]);

  const submit = (raw = text) => {
    const body = raw.trim();
    if (!body || !meId || !bookingId) return;
    const tempId = `tmp-${Date.now()}`;
    const key = qk.messages(bookingId);
    client.setQueryData<ChatMessage[]>(key, (prev) => [...(prev ?? []), { id: tempId, bookingId, senderId: meId, body, createdAt: new Date().toISOString() }]);
    setText('');
    const dropTemp = () => client.setQueryData<ChatMessage[]>(key, (prev) => prev?.filter((m) => m.id !== tempId));
    send.mutate(
      { bookingId, body },
      {
        onSuccess: dropTemp,
        onError: (e) => {
          dropTemp();
          setText(body);
          toast.error('Message not sent', errorMessage(e));
        },
      },
    );
  };

  const header = (
    <Header
      title={other ? other.name : 'Chat'}
      subtitle={booking.data ? `${booking.data.tripCode} · ${booking.data.boardStop.place.name} → ${booking.data.alightStop.place.name}` : undefined}
      right={other ? <Avatar name={other.name} photoUrl={other.photoUrl} size={40} /> : undefined}
    />
  );

  const composer = (
    <View style={s.composer}>
      <Input
        value={text}
        onChangeText={setText}
        placeholder={other ? `Message ${firstName(other.name)}` : 'Message'}
        multiline
        maxLength={1000}
        containerStyle={s.flex}
        style={s.input}
        testID="chat-input"
      />
      <Pressable
        onPress={() => submit()}
        disabled={!text.trim()}
        accessibilityRole="button"
        accessibilityLabel="Send"
        style={({ pressed }) => [s.send, !text.trim() ? s.sendDisabled : null, pressed ? s.pressed : null]}
        testID="chat-send"
      >
        <Icon name="arrow-up" size={22} color="onPrimary" />
      </Pressable>
    </View>
  );

  return (
    <Screen headerNode={header} scroll={false} padding={0} footer={composer}>
      {messages.isPending ? (
        <LoadingState label="Loading messages…" />
      ) : messages.isError ? (
        <ErrorState error={messages.error} title="Couldn't load messages" onRetry={() => void messages.refetch()} />
      ) : (
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[s.list, list.length === 0 ? s.listEmpty : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.privacy}>
              <Icon name="lock-closed" size={12} color="ink3" />
              <Text variant="caption" color="ink3">
                Messages stay in Take Me Home — your number stays private.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Icon name="chatbubbles" size={28} color="primary" />
              </View>
              <Text variant="h3" align="center">
                Say hello{other ? ` to ${firstName(other.name)}` : ''}
              </Text>
              <Text variant="caption" align="center">
                Agree on the pick-up spot or let them know if you&apos;re running late.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === meId;
            const prev = list[index - 1];
            const newDay = !prev || kigaliDayKey(prev.createdAt) !== kigaliDayKey(item.createdAt);
            const pending = item.id.startsWith('tmp-');
            return (
              <View>
                {newDay ? (
                  <Text variant="caption" align="center" style={s.day}>
                    {formatDay(item.createdAt)}
                  </Text>
                ) : null}
                <Animated.View entering={FadeInUp.duration(180)} style={[s.bubbleRow, mine ? s.rowMine : s.rowTheirs]}>
                  <View style={[s.bubble, mine ? s.mine : s.theirs, pending ? s.pending : null]}>
                    <Text variant="body" style={mine ? s.mineText : null}>
                      {item.body}
                    </Text>
                    <Text variant="caption" style={[s.time, mine ? s.mineTime : null]}>
                      {pending ? 'Sending…' : kigaliTime(item.createdAt)}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            );
          }}
        />
      )}
      {!messages.isPending && list.length === 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quick} style={s.quickScroll} keyboardShouldPersistTaps="handled">
          {QUICK_REPLIES.map((q) => (
            <Chip key={q} label={q} onPress={() => submit(q)} />
          ))}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  list: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  listEmpty: { flexGrow: 1 },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  day: { marginVertical: 8 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, gap: 2 },
  mine: { backgroundColor: t.colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: t.colors.surface, borderBottomLeftRadius: 6, ...t.shadows.sm },
  pending: { opacity: 0.6 },
  mineText: { color: t.colors.onPrimary },
  time: { fontSize: 11, lineHeight: 14, alignSelf: 'flex-end' },
  mineTime: { color: t.colors.tint },
  quickScroll: { flexGrow: 0 },
  quick: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { maxHeight: 120 },
  send: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center', ...t.shadows.primary },
  sendDisabled: { opacity: 0.4 },
}));
