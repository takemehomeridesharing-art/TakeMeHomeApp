import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json at build time. Google Maps keys are only needed for production/dev-client
 * builds that use Google Maps (Expo Go ships its own):
 *
 *   GOOGLE_MAPS_ANDROID_API_KEY=… GOOGLE_MAPS_IOS_API_KEY=… eas build
 *
 * Android's react-native-maps always renders through Google Maps, so a production Android build
 * needs GOOGLE_MAPS_ANDROID_API_KEY even when it draws our own tiles on top.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const android = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const ios = process.env.GOOGLE_MAPS_IOS_API_KEY;
  return {
    ...config,
    name: config.name ?? 'Take Me Home',
    slug: config.slug ?? 'take-me-home',
    plugins: [
      ...(config.plugins ?? []),
      ...(android || ios
        ? [['react-native-maps', { ...(android ? { androidGoogleMapsApiKey: android } : {}), ...(ios ? { iosGoogleMapsApiKey: ios } : {}) }] as [string, object]]
        : []),
    ],
  };
};
