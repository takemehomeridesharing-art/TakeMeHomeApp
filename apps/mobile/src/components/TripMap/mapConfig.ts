/**
 * Where native map imagery comes from. Set at build time with EXPO_PUBLIC_* variables:
 *
 * - default: OpenStreetMap's public tiles — fine for development, but their usage policy does not
 *   allow production-scale traffic.
 * - EXPO_PUBLIC_MAP_TILE_URL (+ EXPO_PUBLIC_MAP_ATTRIBUTION): any XYZ tile server, e.g. a paid
 *   OSM-based provider (MapTiler, Stadia, Thunderforest) with your key in the URL.
 * - EXPO_PUBLIC_MAP_PROVIDER=google: Google Maps base map (needs GOOGLE_MAPS_*_API_KEY at build
 *   time, see app.config.ts).
 */
export interface MapImagery {
  provider: 'tiles' | 'google';
  tileUrl: string;
  attribution: string | null;
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function mapImagery(env: Record<string, string | undefined> = process.env): MapImagery {
  if (env.EXPO_PUBLIC_MAP_PROVIDER === 'google') return { provider: 'google', tileUrl: '', attribution: null };
  const custom = env.EXPO_PUBLIC_MAP_TILE_URL?.trim();
  return {
    provider: 'tiles',
    tileUrl: custom || OSM_TILES,
    attribution: env.EXPO_PUBLIC_MAP_ATTRIBUTION?.trim() || (custom ? null : '© OpenStreetMap'),
  };
}
