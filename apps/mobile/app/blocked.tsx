import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen, Text, toast } from '@/components';
import { firstName } from '@/features/passenger/labels';
import { errorMessage } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { useBlocks, useUnblockUser } from '@/lib/queries';
import { makeStyles } from '@/theme';

/** People I've blocked, with Unblock. */
export default function BlockedScreen() {
  const s = useStyles();
  const q = useBlocks();
  const unblock = useUnblockUser();
  const [busy, setBusy] = useState<string | null>(null);

  const doUnblock = (id: string, name: string) => {
    setBusy(id);
    unblock.mutate(id, {
      onSuccess: () => toast.success(`${firstName(name)} unblocked`),
      onError: (e) => toast.error("Couldn't unblock", errorMessage(e)),
      onSettled: () => setBusy(null),
    });
  };

  return (
    <Screen header={{ title: 'Blocked people' }}>
      <Text variant="body" color="ink2" style={s.intro}>
        People you block can&apos;t see your trips, request to join them or message you — and you won&apos;t see theirs. They aren&apos;t told.
      </Text>
      {q.isPending ? (
        <LoadingState fill={false} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} fill={false} />
      ) : q.data.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="No one blocked" body="If someone makes you uncomfortable, you can block them from their trip or a report." />
      ) : (
        <Card padding={0}>
          {q.data.map((b, i) => (
            <View key={b.user.id} style={[s.row, i < q.data.length - 1 ? s.divider : null]}>
              <Avatar name={b.user.name} photoUrl={b.user.photoUrl} size={44} />
              <View style={s.flex}>
                <Text variant="bodyStrong">{b.user.name}</Text>
                <Text variant="caption">Blocked {formatDay(b.createdAt).toLowerCase() === 'today' ? 'today' : `on ${formatDay(b.createdAt)}`}</Text>
              </View>
              <Button label="Unblock" size="sm" variant="secondary" loading={busy === b.user.id} onPress={() => doUnblock(b.user.id, b.user.name)} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  intro: { marginTop: 4, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
}));
