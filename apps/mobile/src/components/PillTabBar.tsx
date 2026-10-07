import { type BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '@/theme';
import { Text } from './Text';

/**
 * Floating pill bottom navigation for Expo Router `Tabs` (`tabBar={(p) => <PillTabBar {...p} />}`).
 * White pill; the active tab is an indigo pill with icon + label, inactive tabs show their icon.
 * Uses each screen's `title` and `tabBarIcon` options; screens with `href: null` are hidden.
 */
export function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const visible = state.routes.filter((route) => {
    const style = descriptors[route.key]?.options.tabBarItemStyle as ViewStyle | undefined;
    return style?.display !== 'none';
  });

  return (
    <View style={[s.wrap, s.boxNone, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View style={s.bar} accessibilityRole="tablist">
        {visible.map((route) => {
          const options = descriptors[route.key]!.options;
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.onPrimary : colors.ink2;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Animated.View key={route.key} layout={LinearTransition.duration(220)} style={focused ? s.itemFocusedWrap : s.itemWrap}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                testID={`tab-${route.name}`}
                onPress={onPress}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={[s.item, focused ? s.itemFocused : null]}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                {focused ? (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <Text variant="bodyStrong" numberOfLines={1} style={s.label}>
                      {label}
                    </Text>
                  </Animated.View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  boxNone: { pointerEvents: 'box-none' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    maxWidth: 440,
    height: 68,
    padding: 8,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    ...t.shadows.lg,
  },
  itemWrap: { flex: 1 },
  itemFocusedWrap: { flex: 2.2 },
  item: { height: 52, borderRadius: t.radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  itemFocused: { backgroundColor: t.colors.primary, paddingHorizontal: 14 },
  label: { color: t.colors.onPrimary, fontSize: 14 },
}));
