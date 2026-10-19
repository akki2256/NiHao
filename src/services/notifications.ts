import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      // False positive: AndroidImportance is a real runtime export (tsc agrees), but
      // eslint-plugin-import cannot follow expo-notifications' `export *` re-exports.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  try {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResult.data;
    if (token) {
      await api.savePushToken(token);
    }
    return token;
  } catch {
    return null;
  }
}
