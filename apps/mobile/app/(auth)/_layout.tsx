import { Stack } from 'expo-router';
import { useSession } from '@/stores/session';
import { lightColors } from '@/theme';

/** Signed out: welcome → phone → otp. Signed in but incomplete: profile setup only. */
export default function AuthLayout() {
  const signedIn = useSession((s) => Boolean(s.token && s.me));
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: lightColors.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="phone" />
        <Stack.Screen name="otp" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
    </Stack>
  );
}
