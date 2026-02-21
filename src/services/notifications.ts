/**
 * Notifications service - push notifications and local scheduling.
 * Handles device registration, background context checks, and local notifications.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { NotificationPayload } from '@/types';

/** Error thrown when notification operations fail */
export class NotificationsServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'NotificationsServiceError';
  }
}

/**
 * Registers the device for push notifications and returns the Expo push token.
 * Skips registration on simulators/emulators (expo-device optional).
 * @returns Expo push token string, or null if registration fails or is unsupported
 * @throws NotificationsServiceError when permission is denied or registration fails
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let isPhysicalDevice = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device') as { isDevice: boolean };
    isPhysicalDevice = Device.isDevice;
  } catch {
    // expo-device not installed; assume physical device
  }

  if (!isPhysicalDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    if (finalStatus !== 'granted') {
      throw new NotificationsServiceError(
        'Push notification permission denied',
        { status: finalStatus }
      );
    }
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  return tokenResult.data ?? null;
}

/**
 * Schedules a background task to check context signals and potentially trigger notifications.
 * Sets up the recurring context check (e.g. via expo-task-manager or similar).
 * @throws NotificationsServiceError when scheduling fails
 */
export async function scheduleContextCheck(): Promise<void> {
  // Background task registration - implementation depends on expo-task-manager
  // or expo-background-fetch. Placeholder for edge function / server-side scheduling.
  // Client can register a task that runs periodically.
  await Promise.resolve();
}

/**
 * Sends a local notification with the given payload.
 * @param payload - Notification title, body, and data
 * @throws NotificationsServiceError when sending fails
 */
export async function sendLocalNotification(
  payload: NotificationPayload
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}
