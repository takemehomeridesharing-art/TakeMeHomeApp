import { type JoinRequest } from '@tmh/shared';
import { View } from 'react-native';
import { Icon, Text } from '@/components';
import { makeStyles } from '@/theme';
import { JoinRequestCard } from './JoinRequestCard';

/** Pending requests to join (newest first), each animating in as it arrives. */
export function RequestsList({ requests, emptyText }: { requests: readonly JoinRequest[]; emptyText?: string }) {
  const s = useStyles();
  const pending = requests.filter((r) => r.status === 'pending').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (pending.length === 0) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Icon name="notifications-outline" size={18} color="primary" />
        </View>
        <Text variant="caption" style={s.emptyText}>
          {emptyText ?? "No requests right now. We'll ping you the moment someone asks to join — it shows up here instantly."}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.list} testID="requests-list">
      {pending.map((r) => (
        <JoinRequestCard key={r.id} request={r} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  list: { gap: 12 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: t.radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.colors.line, backgroundColor: t.colors.surface },
  emptyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  emptyText: { flex: 1 },
}));
