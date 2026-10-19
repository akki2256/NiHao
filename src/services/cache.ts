import AsyncStorage from '@react-native-async-storage/async-storage';
import { coerceAppData } from '../domain/coerce';
import { AppData } from '../types/models';

const KEY = 'nihao_cache_v2';

export async function saveCache(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function loadCache(): Promise<AppData | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return coerceAppData(JSON.parse(raw)).data;
  } catch {
    return null;
  }
}
