import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Minimal async key-value interface shared by the storage adapters below. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const webLocalStorage: KeyValueStorage = {
  async getItem(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // private mode / storage disabled: the session just won't survive a reload
    }
  },
  async removeItem(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const nativeSecureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/**
 * Small secrets (the auth token, the mode): Keychain/Keystore via expo-secure-store on native,
 * localStorage on web. SecureStore values should stay under ~2 KB.
 */
export const secureStorage: KeyValueStorage = Platform.OS === 'web' ? webLocalStorage : nativeSecureStorage;

/** Larger, non-secret cached data (e.g. the last `Me` payload). AsyncStorage (localStorage on web). */
export const cacheStorage: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
