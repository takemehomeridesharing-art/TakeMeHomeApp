import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  /** Show the back button (default true when `onBack` is given or the stack can go back). */
  back?: boolean;
  /** Custom back action. Defaults to `router.back()` (or home when there's no history). */
  onBack?: () => void;
  /** Right-side slot, e.g. `<HeaderIconButton icon="share-outline" … />`. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Round white icon button used in headers and over maps. */
export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Shows a small amber dot. */
  badge?: boolean;
}) {
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed ? s.pressed : null]}>
      <Icon name={icon} size={20} />
      {badge ? <View style={s.dot} /> : null}
    </Pressable>
  );
}

/** Screen header: back button · centred title (+ subtitle) · right action. */
export function Header({ title, subtitle, back, onBack, right, style }: HeaderProps) {
  const s = useStyles();
  const showBack = back ?? (Boolean(onBack) || router.canGoBack());
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[s.header, style]}>
      <View style={s.side}>{showBack ? <HeaderIconButton icon="chevron-back" onPress={goBack} accessibilityLabel="Back" /> : null}</View>
      <View style={s.center}>
        {title ? (
          <Text variant="h3" numberOfLines={1} align="center">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" numberOfLines={1} align="center">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[s.side, s.right]}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: t.space.lg, gap: t.space.sm },
  side: { width: 44, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.sm,
  },
  pressed: { opacity: 0.7 },
  dot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.accent,
    borderWidth: 1.5,
    borderColor: t.colors.surface,
  },
}));
