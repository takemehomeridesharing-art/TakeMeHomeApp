import { Platform, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { makeStyles, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  icon?: IconName;
  /** Tap action (e.g. open the notification's deep link). */
  onPress?: () => void;
  /** Auto-hide after ms (default 4000). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show(options: ToastOptions): number;
  hide(id: number): void;
}

let nextId = 1;
const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],
  show(options) {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { ...options, id }] });
    setTimeout(() => get().hide(id), options.duration ?? 4000);
    return id;
  },
  hide(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/**
 * Imperative toast API, usable anywhere (components, mutation callbacks):
 * `toast.show({ title: 'Request sent', tone: 'success' })`, `toast.error(err)`.
 */
export const toast = {
  show: (options: ToastOptions) => useToastStore.getState().show(options),
  success: (title: string, message?: string) => useToastStore.getState().show({ title, message, tone: 'success' }),
  error: (title: string, message?: string) => useToastStore.getState().show({ title, message, tone: 'error' }),
  hide: (id: number) => useToastStore.getState().hide(id),
};

const TONE: Record<ToastTone, { icon: IconName; color: keyof ColorTokens; bg: keyof ColorTokens }> = {
  info: { icon: 'notifications', color: 'primary', bg: 'tint' },
  success: { icon: 'checkmark-circle', color: 'success', bg: 'mint' },
  error: { icon: 'alert-circle', color: 'coral', bg: 'coralWash' },
};

/** Renders active toasts as top banners. Mount once in the root layout. */
export function ToastHost() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((st) => st.toasts);
  const hide = useToastStore((st) => st.hide);
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[s.host, { top: insets.top + 8 }]}>
      {toasts.map((t) => {
        const tone = TONE[t.tone ?? 'info'];
        return (
          <Animated.View key={t.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={s.toastWrap}>
            <Pressable
              accessibilityRole="alert"
              onPress={() => {
                hide(t.id);
                t.onPress?.();
              }}
              style={({ pressed }) => [s.toast, pressed ? s.pressed : null]}
            >
              <View style={[s.iconCircle, s[tone.bg as 'tint']]}>
                <Icon name={t.icon ?? tone.icon} size={18} color={tone.color} />
              </View>
              <View style={s.texts}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {t.title}
                </Text>
                {t.message ? (
                  <Text variant="caption" numberOfLines={2}>
                    {t.message}
                  </Text>
                ) : null}
              </View>
              {t.onPress ? <Icon name="chevron-forward" size={16} color="ink3" /> : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  host: { position: 'absolute', left: 12, right: 12, alignItems: 'center', gap: 8, zIndex: 1000, ...(Platform.OS === 'web' ? { position: 'fixed' as 'absolute' } : null) },
  toastWrap: { width: '100%', maxWidth: 480 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.line,
    ...t.shadows.lg,
  },
  pressed: { opacity: 0.9 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tint: { backgroundColor: t.colors.tint },
  mint: { backgroundColor: t.colors.mint },
  coralWash: { backgroundColor: t.colors.coralWash },
  texts: { flex: 1, gap: 1 },
}));
