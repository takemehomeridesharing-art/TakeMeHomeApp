import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { makeStyles } from '@/theme';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  /** Called on backdrop tap, drag-down, or Android back. */
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky footer (CTA row) under the scrollable content. */
  footer?: ReactNode;
  /** Prevent closing by backdrop/drag (e.g. while a payment is in flight). */
  dismissible?: boolean;
  /** Max height as a fraction of the window (default 0.9). */
  maxHeightRatio?: number;
}

const OPEN = { duration: 280, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) };

/** Modal sheet that slides up over a dimmed backdrop, with a drag handle (drag down to dismiss). */
export function BottomSheet({ visible, onClose, title, subtitle, children, footer, dismissible = true, maxHeightRatio = 0.9 }: BottomSheetProps) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(windowHeight);
  const backdrop = useSharedValue(0);

  // Mount immediately when opened; unmount after the closing animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      translateY.value = windowHeight;
      translateY.value = withTiming(0, OPEN);
      backdrop.value = withTiming(1, OPEN);
    } else if (mounted) {
      backdrop.value = withTiming(0, CLOSE);
      translateY.value = withTiming(windowHeight, CLOSE, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, mounted, windowHeight, translateY, backdrop]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={[s.sheet, { maxHeight: windowHeight * maxHeightRatio, paddingBottom: Math.max(insets.bottom, 16) }, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={s.handleArea}>
              <View style={s.handle} />
              {title ? (
                <View style={s.titles}>
                  <Text variant="h2">{title}</Text>
                  {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
                </View>
              ) : null}
            </View>
          </GestureDetector>
          <ScrollView style={s.scroll} contentContainerStyle={s.content} bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: { backgroundColor: t.colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...t.shadows.lg,
    ...(Platform.OS === 'web' ? { maxWidth: 560, marginHorizontal: 'auto' } : null),
  },
  handleArea: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.line, marginBottom: 12 },
  titles: { gap: 2 },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
}));
