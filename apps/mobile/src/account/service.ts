import { createClient, processLock } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { createAccountController, type AccountController } from './controller';
import { createAccountStorage, type CredentialStorage } from './storage';
import { createAccountAuthAdapter, createAccountFetch } from './auth-adapter';

let singleton: AccountController | null = null;

export function getAccountService(): AccountController {
  if (singleton) return singleton;
  const memory = new Map<string,string>();
  const native: CredentialStorage = Platform.OS === 'web'
    ? { getItem: async key => memory.get(key) ?? null, setItem: async (key,value) => { memory.set(key,value); }, removeItem: async key => { memory.delete(key); } }
    : { getItem: SecureStore.getItemAsync, setItem: (key,value) => SecureStore.setItemAsync(key,value,{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }), removeItem: SecureStore.deleteItemAsync };
  const storage = createAccountStorage(native, () => Crypto.randomUUID());
  const url = process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY;
  const enabled = process.env.EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_ENABLED === 'true';
  const client = enabled && url && /^https:\/\/[^/]+$/.test(url) && key
    ? createClient(url,key,{ global: { fetch: createAccountFetch(fetch) }, auth: { storageKey: 'travel-life-account-v1', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, lock: (name,_timeout,work) => processLock(name,-1,work) } }) : null;
  singleton = createAccountController(client ? createAccountAuthAdapter(client,storage) : null, storage);
  if (Platform.OS !== 'web') {
    const controller = singleton;
    AppState.addEventListener('change', state => controller.foreground(state === 'active'));
    // One listener belongs to this process singleton, not each screen mount.
    controller.subscribe(() => controller.foreground(AppState.currentState === 'active'));
  }
  return singleton;
}
