import { type AuthResponse, type Me } from '@tmh/shared';
import { create } from 'zustand';
import { api, ApiError, configureApiAuth } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { cacheStorage, secureStorage } from '@/lib/storage';

/** Which side of the app the user is using. One account can be both. */
export type AppMode = 'passenger' | 'driver';

export interface SessionState {
  /** True once the persisted session has been loaded from storage. */
  hydrated: boolean;
  token: string | null;
  me: Me | null;
  mode: AppMode;
  /** Store the session returned by `POST /auth/otp/verify`. */
  signIn(auth: AuthResponse): Promise<void>;
  /** Forget the token, cached user and all server state. */
  signOut(): Promise<void>;
  setMode(mode: AppMode): void;
  /** Replace the cached user (e.g. after `PATCH /me`). */
  setMe(me: Me): void;
  /** Re-fetch `GET /me`. Returns null if signed out or it failed. */
  refreshMe(): Promise<Me | null>;
}

const TOKEN_KEY = 'tmh.token';
const MODE_KEY = 'tmh.mode';
const ME_KEY = 'tmh.me';

/** The signed-in session (token, user, mode), persisted across launches. */
export const useSession = create<SessionState>()((set, get) => ({
  hydrated: false,
  token: null,
  me: null,
  mode: 'passenger',

  async signIn(auth) {
    queryClient.clear();
    set({ token: auth.token, me: auth.user });
    await Promise.all([secureStorage.setItem(TOKEN_KEY, auth.token), cacheStorage.setItem(ME_KEY, JSON.stringify(auth.user))]);
  },

  async signOut() {
    set({ token: null, me: null, mode: 'passenger' });
    queryClient.clear();
    await Promise.all([secureStorage.removeItem(TOKEN_KEY), secureStorage.removeItem(MODE_KEY), cacheStorage.removeItem(ME_KEY)]);
  },

  setMode(mode) {
    set({ mode });
    void secureStorage.setItem(MODE_KEY, mode);
  },

  setMe(me) {
    set({ me });
    queryClient.setQueryData(['me'], me);
    void cacheStorage.setItem(ME_KEY, JSON.stringify(me));
  },

  async refreshMe() {
    if (!get().token) return null;
    try {
      const me = await api.get<Me>('/me');
      get().setMe(me);
      return me;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await get().signOut();
      return null;
    }
  },
}));

configureApiAuth({
  getToken: () => useSession.getState().token,
  onUnauthorized: () => void useSession.getState().signOut(),
});

async function hydrate(): Promise<void> {
  try {
    const [token, mode, meJson] = await Promise.all([
      secureStorage.getItem(TOKEN_KEY),
      secureStorage.getItem(MODE_KEY),
      cacheStorage.getItem(ME_KEY),
    ]);
    let me: Me | null = null;
    try {
      me = meJson ? (JSON.parse(meJson) as Me) : null;
    } catch {
      me = null;
    }
    useSession.setState({ token, me: token ? me : null, mode: mode === 'driver' ? 'driver' : 'passenger' });
    if (token && !me) await useSession.getState().refreshMe();
  } finally {
    useSession.setState({ hydrated: true });
  }
  // Refresh the cached user in the background.
  if (useSession.getState().token) void useSession.getState().refreshMe();
}

void hydrate();

/** Convenience selector: signed in with a known user. */
export const selectSignedIn = (s: SessionState) => Boolean(s.token && s.me);
