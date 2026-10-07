// Per-weight subpath imports so only the weights we use are bundled.
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_500Medium } from '@expo-google-fonts/public-sans/500Medium';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { PublicSans_700Bold } from '@expo-google-fonts/public-sans/700Bold';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MomoPrompt } from '@/components/MomoPrompt';
import { RealtimeBridge } from '@/components/RealtimeBridge';
import { ToastHost } from '@/components/Toast';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/stores/session';
import { lightColors, ThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export { ErrorBoundary } from 'expo-router';

/** Root: fonts + splash, providers, global overlays, and the auth gate (Stack.Protected). */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    ...Ionicons.font,
  });
  const hydrated = useSession((s) => s.hydrated);
  const ready = (fontsLoaded || Boolean(fontError)) && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <RootStack />
            <RealtimeBridge />
            <MomoPrompt />
            <ToastHost />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Auth gate:
 * - signed out → (auth): welcome / phone / otp
 * - signed in, profile incomplete → (auth)/profile-setup
 * - signed in + complete → (tabs) and every stack route below
 * Expo Router redirects automatically when a guard flips.
 */
function RootStack() {
  const signedIn = useSession((s) => Boolean(s.token && s.me));
  const profileComplete = useSession((s) => Boolean(s.me?.profileComplete));
  const inApp = signedIn && profileComplete;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: lightColors.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!inApp}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="request/[id]" />
        <Stack.Screen name="pay/[requestId]" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="track/[bookingId]" />
        <Stack.Screen name="chat/[bookingId]" />
        <Stack.Screen name="rate/[bookingId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="vehicle/new" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="history" />
        <Stack.Screen name="blocked" />
      </Stack.Protected>
      <Stack.Screen name="dev/kit" />
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: lightColors.bg } });
