import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PlannedSession } from './plannedSessionAPI';

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('planned-sessions', {
        name: 'Planned Sessions',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#335C67',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a notification for a planned session
 * Sends notification at 8:00 AM on the session date
 */
export async function schedulePlannedSessionNotification(
  session: PlannedSession
): Promise<string | null> {
  try {
    // Check if reminders are enabled for this session
    if (!session.reminderEnabled) {
      return null;
    }

    // Request permission if not already granted
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Cannot schedule notification without permission');
      return null;
    }

    // Parse the planned date
    const plannedDate = new Date(session.plannedDate);
    
    // Set notification time to 8:00 AM on the planned date
    const notificationDate = new Date(plannedDate);
    notificationDate.setHours(8, 0, 0, 0);

    // Don't schedule if the time has already passed
    if (notificationDate <= new Date()) {
      console.log('Notification time has already passed, skipping');
      return null;
    }

    // Schedule the notification using DATE trigger (not time-based trigger)
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🐴 Planned Session Reminder',
        body: `You have a planned session with ${session.horseName} today: ${session.title}`,
        data: {
          sessionId: session.id,
          type: 'planned-session-reminder',
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationDate,
      },
    });

    console.log(`✅ Scheduled notification ${notificationId} for ${session.title} at ${notificationDate.toISOString()}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Schedule notifications for repeating sessions
 * Generates notifications up to 30 days in advance
 */
export async function scheduleRepeatingSessionNotifications(
  session: PlannedSession
): Promise<string[]> {
  try {
    if (!session.reminderEnabled || !session.repeatEnabled || !session.repeatPattern) {
      return [];
    }

    const notificationIds: string[] = [];
    const originalDate = new Date(session.plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Schedule up to 30 days in advance
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);

    let currentDate = new Date(originalDate);

    // If original date is in the past, start from next occurrence
    while (currentDate < today) {
      switch (session.repeatPattern) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    // Schedule notifications for upcoming occurrences
    while (currentDate <= maxDate) {
      const virtualSession: PlannedSession = {
        ...session,
        plannedDate: currentDate.toISOString(),
      };

      const notificationId = await schedulePlannedSessionNotification(virtualSession);
      if (notificationId) {
        notificationIds.push(notificationId);
      }

      // Move to next occurrence
      const nextDate = new Date(currentDate);
      switch (session.repeatPattern) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
      currentDate = nextDate;
    }

    console.log(`✅ Scheduled ${notificationIds.length} repeating notifications for ${session.title}`);
    return notificationIds;
  } catch (error) {
    console.error('Error scheduling repeating notifications:', error);
    return [];
  }
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`❌ Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

/**
 * Cancel all notifications for a specific session
 */
export async function cancelSessionNotifications(sessionId: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      const notifSessionId = notification.content.data?.sessionId as string | undefined;
      if (notifSessionId === sessionId ||
          (typeof notifSessionId === 'string' && notifSessionId.startsWith(sessionId))) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`❌ Cancelled notification for session ${sessionId}`);
      }
    }
  } catch (error) {
    console.error('Error cancelling session notifications:', error);
  }
}
