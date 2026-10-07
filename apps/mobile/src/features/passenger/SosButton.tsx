import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Text } from '@/components';
import { makeStyles } from '@/theme';

/** Big coral SOS button with a slow "breathing" halo. */
export function SosButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const s = useStyles();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [p]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.35 }] }));

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.halo, halo]} />
      <View style={s.ring} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="SOS — alert your trusted contact and the safety team"
        style={({ pressed }) => [s.button, pressed ? s.pressed : null]}
        testID={testID}
      >
        <Text style={s.label}>SOS</Text>
      </Pressable>
    </View>
  );
}

const SIZE = 108;
const useStyles = makeStyles((t) => ({
  wrap: { width: SIZE * 1.5, height: SIZE * 1.5, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: SIZE * 1.2, height: SIZE * 1.2, borderRadius: SIZE * 0.6, backgroundColor: t.colors.coralWash },
  ring: { position: 'absolute', width: SIZE * 1.2, height: SIZE * 1.2, borderRadius: SIZE * 0.6, backgroundColor: t.colors.coralWash },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: t.colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.lg,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  label: { fontFamily: t.fonts.headingHeavy, fontSize: 30, lineHeight: 36, letterSpacing: 1.5, color: t.colors.onPrimary },
}));
