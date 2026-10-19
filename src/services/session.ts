import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Contributor } from '../types/models';

const SESSION_KEY = 'nihao_session_v2';
const BIO_KEY = 'nihao_bio_enabled';

export interface SavedSession {
  token: string;
  user: Contributor;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone.
  }
}

export async function loadSession(): Promise<SavedSession | null> {
  const raw = await secureGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (!parsed.token || !parsed.user?.contributor_id) return null;
    const user: Contributor = { ...parsed.user };
    delete user.password_hash;
    delete user.push_token;
    return { token: parsed.token, user };
  } catch {
    return null;
  }
}

export async function saveSession(session: SavedSession): Promise<void> {
  const user: Contributor = { ...session.user };
  delete user.password_hash;
  delete user.push_token;
  await secureSet(SESSION_KEY, JSON.stringify({ token: session.token, user }));
}

export async function clearSession(): Promise<void> {
  await secureDelete(SESSION_KEY);
  await secureDelete(BIO_KEY);
  try {
    await AsyncStorage.removeItem('nihao_session_user');
    await AsyncStorage.removeItem(BIO_KEY);
  } catch {
    // Legacy copy from before sessions lived only in SecureStore.
  }
}

export async function getBioEnabled(): Promise<boolean> {
  return (await secureGet(BIO_KEY)) === '1';
}

export async function setBioEnabled(enabled: boolean): Promise<void> {
  if (enabled) await secureSet(BIO_KEY, '1');
  else await secureDelete(BIO_KEY);
}
