import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  ListRow,
  Screen,
  SegmentedControl,
  Stars,
  Text,
  VerificationChips,
  type SegmentedOption,
} from '@/components';
import { formatPhone } from '@/lib/format';
import { useMe } from '@/lib/queries';
import { useSession, type AppMode } from '@/stores/session';
import { makeStyles } from '@/theme';

const MODES: SegmentedOption<AppMode>[] = [
  { value: 'passenger', label: 'Passenger', icon: 'person' },
  { value: 'driver', label: 'Driver', icon: 'car-sport' },
];

/** Profile tab (foundation version): who you are, trust chips, mode switch, links and sign out. */
export default function ProfileTab() {
  const s = useStyles();
  const { data: me } = useMe();
  const mode = useSession((st) => st.mode);
  const setMode = useSession((st) => st.setMode);
  const signOut = useSession((st) => st.signOut);

  if (!me) return null;

  const switchMode = (next: AppMode) => {
    setMode(next);
    router.navigate(next === 'driver' ? '/my-trip' : '/home');
  };

  return (
    <Screen tabBarSpace>
      <Text variant="h1" style={s.title}>
        Profile
      </Text>

      <Card style={s.card}>
        <View style={s.who}>
          <Avatar name={me.name} photoUrl={me.photoUrl} size={64} />
          <View style={s.whoText}>
            <Text variant="h2" numberOfLines={1}>
              {me.name}
            </Text>
            <Text variant="caption">{formatPhone(me.phone)}</Text>
            <Stars value={me.ratingAvg} count={me.ratingCount} showValue size={14} />
          </View>
        </View>
        <VerificationChips chips={me.verification} />
      </Card>

      <Card style={s.card}>
        <Text variant="label">Mode</Text>
        <SegmentedControl options={MODES} value={mode} onChange={switchMode} testID="mode-switch" />
        <Text variant="caption">
          {mode === 'driver'
            ? 'Publish trips you already make and share the running cost.'
            : 'Find a seat on a trip that is already going your way.'}
        </Text>
      </Card>

      <Card style={s.card} padding={8}>
        <View style={s.list}>
          <ListRow icon="shield-checkmark" title="Verify your identity" subtitle="Email, ID, licence and vehicle" onPress={() => router.push('/verify')} divider />
          <ListRow icon="car-sport" title="Vehicles" subtitle={me.vehicles.length ? `${me.vehicles.length} registered` : 'Add the car you drive'} onPress={() => router.push('/vehicle/new')} divider />
          <ListRow icon="notifications" title="Notifications" onPress={() => router.push('/notifications')} divider />
          <ListRow icon="time" title="Trip history" onPress={() => router.push('/history')} divider />
          <ListRow icon="ban" title="Blocked users" onPress={() => router.push('/blocked')} divider />
          <ListRow icon="flag" iconColor="coral" title="Report a problem" onPress={() => router.push('/report')} />
        </View>
      </Card>

      <Button label="Sign out" variant="ghost" icon="log-out-outline" onPress={() => void signOut()} style={s.signOut} testID="sign-out" />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  title: { marginTop: 12, marginBottom: 16 },
  card: { gap: 14, marginBottom: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  whoText: { flex: 1, gap: 2 },
  list: { paddingHorizontal: 8 },
  signOut: { alignSelf: 'center' },
}));
