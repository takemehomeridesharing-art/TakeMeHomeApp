import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components';
import { makeStyles, useTheme, type ColorTokens } from '@/theme';

export interface PulseRingsProps {
  icon: IconName;
  /** Ring + icon colour token (default primary). */
  tone?: 'primary' | 'accent' | 'success' | 'coral';
  size?: number;
  /** Animate the rings (default true). Off = a calm static badge. */
  active?: boolean;
}

const WASH: Record<NonNullable<PulseRingsProps['tone']>, keyof ColorTokens> = { primary: 'tint', accent: 'accent2', success: 'mint', coral: 'coralWash' };
const INK: Record<NonNullable<PulseRingsProps['tone']>, keyof ColorTokens> = { primary: 'primary', accent: 'accentInk', success: 'success', coral: 'coral' };

/** A round icon badge with gently expanding rings — "we're waiting on someone". */
export function PulseRings({ icon, tone = 'primary', size = 88, active = true }: PulseRingsProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const a = useSharedValue(0);
  const b = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      a.value = 0;
      b.value = 0;
      return;
    }
    const loop = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
    a.value = loop;
    b.value = withDelay(1100, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [active, a, b]);

  const outer = size * 1.9;
  return (
    <View style={[s.wrap, { width: outer, height: outer }]}>
      {active ? (
        <>
          <Ring progress={a} size={size} color={colors[WASH[tone]]} />
          <Ring progress={b} size={size} color={colors[WASH[tone]]} />
        </>
      ) : null}
      <View style={[s.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors[WASH[tone]] }]}>
        <View style={[s.inner, { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33 }]}>
          <Icon name={icon} size={size * 0.34} color={INK[tone]} />
        </View>
      </View>
    </View>
  );
}

function Ring({ progress, size, color }: { progress: SharedValue<number>; size: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.9 }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  core: { alignItems: 'center', justifyContent: 'center' },
  inner: { backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center', ...t.shadows.sm },
}));
