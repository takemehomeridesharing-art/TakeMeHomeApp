import { formatRwf, type MomoPrompt as MomoPromptEvent } from '@tmh/shared';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useSocketEvent } from '@/lib/socket';
import { makeStyles } from '@/theme';
import { Text } from './Text';
import { toast } from './Toast';

/**
 * DEV ONLY — simulates the MTN MoMo USSD push that would appear on the payer's phone. Listens for
 * `momo:prompt` and answers via `POST /dev/momo/:providerRef/respond`. This is the only place in
 * the app that knows payments are mocked; screens just watch the payment status.
 */
export function MomoPrompt() {
  const s = useStyles();
  const [queue, setQueue] = useState<MomoPromptEvent[]>([]);
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const prompt = queue[0];

  useSocketEvent('momo:prompt', (p) => {
    setQueue((q) => (q.some((x) => x.providerRef === p.providerRef) ? q : [...q, p]));
  });

  const respond = async (approve: boolean) => {
    if (!prompt) return;
    setBusy(approve ? 'approve' : 'decline');
    try {
      await api.post(`/dev/momo/${encodeURIComponent(prompt.providerRef)}/respond`, { approve });
      setQueue((q) => q.slice(1));
    } catch (e) {
      toast.error('MoMo simulator', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!prompt) return null;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => void respond(false)}>
      <View style={s.scrim}>
        <View style={s.dialog} accessibilityViewIsModal>
          <View style={s.devTag}>
            <Text style={s.devTagText}>DEV · simulated USSD</Text>
          </View>
          <Text style={s.title}>MTN MoMo</Text>
          <Text style={s.message}>
            Pay {formatRwf(prompt.amount)} to {prompt.merchant.toUpperCase()}?{'\n'}
            From {formatPhone(prompt.msisdn)}.{'\n'}
            Ref: {prompt.providerRef}
            {'\n\n'}Enter PIN to approve.
          </Text>
          <View style={s.pin}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={s.pinDot} />
            ))}
          </View>
          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => void respond(false)}
              style={({ pressed }) => [s.action, pressed ? s.pressed : null]}
            >
              <Text style={s.decline}>{busy === 'decline' ? 'Sending…' : 'Decline'}</Text>
            </Pressable>
            <View style={s.sep} />
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => void respond(true)}
              style={({ pressed }) => [s.action, pressed ? s.pressed : null]}
              testID="momo-approve"
            >
              <Text style={s.approve}>{busy === 'approve' ? 'Sending…' : 'Approve'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialog: { width: '100%', maxWidth: 340, backgroundColor: '#FAFAFA', borderRadius: 6, paddingTop: 20, overflow: 'hidden', ...t.shadows.lg },
  devTag: { position: 'absolute', top: 8, right: 8, backgroundColor: t.colors.ink, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  devTagText: { color: '#FFFFFF', fontSize: 10, fontFamily: t.fonts.bodyBold, letterSpacing: 0.4 },
  title: { paddingHorizontal: 20, fontSize: 17, fontFamily: t.fonts.bodyBold, color: '#111111', marginBottom: 8 },
  message: { paddingHorizontal: 20, fontSize: 15, lineHeight: 21, color: '#222222', fontFamily: t.fonts.body },
  pin: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 14, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#0F7B6C' },
  pinDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#222222' },
  actions: { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  action: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center' },
  sep: { width: 1, backgroundColor: '#E0E0E0' },
  pressed: { backgroundColor: '#EEEEEE' },
  decline: { fontFamily: t.fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, color: '#555555', textTransform: 'uppercase' },
  approve: { fontFamily: t.fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, color: '#0F7B6C', textTransform: 'uppercase' },
}));
