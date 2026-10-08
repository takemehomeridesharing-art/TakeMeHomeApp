/**
 * Where native map imagery comes from. Set at build time with EXPO_PUBLIC_* variables:
 *
 * - default on Android: Google's base map (react-native-maps renders through the Google Maps SDK
 *   there anyway; Expo Go ships a key, production builds need GOOGLE_MAPS_ANDROID_API_KEY).
 *   OpenStreetMap's public tile servers refuse requests from apps that don't identify themselves,
 *   which left the Android map black.
 * - default on iOS: OpenStreetMap's public tiles drawn over Apple Maps (Apple's map shows through
 *   if a tile fails). Fine for development; OSM's usage policy forbids production-scale traffic.
 * - EXPO_PUBLIC_MAP_TILE_URL (+ EXPO_PUBLIC_MAP_ATTRIBUTION): any XYZ tile server on both
 *   platforms, e.g. a paid OSM-based provider (MapTiler, Stadia, Thunderforest) with your key.
 * - EXPO_PUBLIC_MAP_PROVIDER=google: Google's base map on both platforms (needs
 *   GOOGLE_MAPS_IOS_API_KEY for iOS builds, see app.config.ts).
 */
export interface MapImagery {
  provider: 'tiles' | 'google' | 'platform';
  tileUrl: string;
  attribution: string | null;
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function mapImagery(env: Record<string, string | undefined>, os: string): MapImagery {
  const custom = env.EXPO_PUBLIC_MAP_TILE_URL?.trim();
  if (custom) return { provider: 'tiles', tileUrl: custom, attribution: env.EXPO_PUBLIC_MAP_ATTRIBUTION?.trim() || null };
  if (env.EXPO_PUBLIC_MAP_PROVIDER === 'google' || os === 'android') return { provider: 'google', tileUrl: '', attribution: null };
  return { provider: 'tiles', tileUrl: OSM_TILES, attribution: '© OpenStreetMap' };
}
