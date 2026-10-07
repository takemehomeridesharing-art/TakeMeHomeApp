import { Tabs } from 'expo-router/js-tabs';
import { Icon, PillTabBar, type IconName } from '@/components';
import { useSession } from '@/stores/session';

type TabDef = { name: string; title: string; icon: IconName; iconActive: IconName; mode: 'passenger' | 'driver' | 'both' };

// Declaration order = pill order: passenger sees home/rides/trips/profile, driver my-trip/publish/trips/profile.
const TABS: TabDef[] = [
  { name: 'home', title: 'Home', icon: 'home-outline', iconActive: 'home', mode: 'passenger' },
  { name: 'my-trip', title: 'My Trip', icon: 'navigate-outline', iconActive: 'navigate', mode: 'driver' },
  { name: 'rides', title: 'Rides', icon: 'ticket-outline', iconActive: 'ticket', mode: 'passenger' },
  { name: 'publish', title: 'Publish', icon: 'add-circle-outline', iconActive: 'add-circle', mode: 'driver' },
  { name: 'trips', title: 'Trips', icon: 'car-outline', iconActive: 'car', mode: 'both' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person', mode: 'both' },
];

/** Bottom tabs with the floating pill bar; the visible set depends on passenger/driver mode. */
export default function TabsLayout() {
  const mode = useSession((s) => s.mode);
  return (
    <Tabs
      initialRouteName={mode === 'driver' ? 'my-trip' : 'home'}
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: t.mode === 'both' || t.mode === mode ? undefined : null,
            tabBarIcon: ({ focused, color, size }) => <Icon name={focused ? t.iconActive : t.icon} color={String(color)} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
