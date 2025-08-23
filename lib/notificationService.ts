import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'friend_request' | 'post_like' | 'post_comment';
  senderId: string;
  senderName: string;
  message: string;
}

export class NotificationService {
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    let token = null;
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        })).data;
        console.log('Push token:', token);
      } catch (error) {
        console.log('Error getting push token:', error);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  static async savePushToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error saving push token:', error);
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  static async sendPushNotification(
    recipientUserId: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<boolean> {
    try {
      // Get the recipient's push token from the database
      const { data: tokenData, error } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', recipientUserId)
        .single();

      if (error || !tokenData?.push_token) {
        console.log('No push token found for user:', recipientUserId);
        return false;
      }

      // Send the push notification using Expo's push service
      const message = {
        to: tokenData.push_token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
        channelId: 'default',
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      
      if (result.data?.status === 'ok') {
        console.log('Push notification sent successfully');
        return true;
      } else {
        console.error('Failed to send push notification:', result);
        return false;
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  static async sendFriendRequestNotification(
    recipientUserId: string,
    senderName: string,
    senderId: string
  ): Promise<boolean> {
    const title = 'New Friend Request';
    const body = `${senderName} sent you a friend request`;
    const data: NotificationData = {
      type: 'friend_request',
      senderId: senderId,
      senderName: senderName,
      message: body,
    };

    return await this.sendPushNotification(recipientUserId, title, body, data);
  }

  static async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    seconds: number = 0
  ): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: data || {},
        sound: 'default',
      },
      trigger: seconds > 0 ? { seconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL } : null,
    });

    return notificationId;
  }

  static async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  static async clearNotification(notificationId: string): Promise<void> {
    await Notifications.dismissNotificationAsync(notificationId);
  }
}

// Notification response handler type
export type NotificationResponse = {
  notification: Notifications.Notification;
  actionIdentifier: string;
};

// Helper function to handle notification taps
export const handleNotificationResponse = (response: NotificationResponse) => {
  const data = response.notification.request.content.data as unknown as NotificationData;
  
  switch (data.type) {
    case 'friend_request':
      // Navigate to community screen and open notifications modal
      // This would be handled in your navigation setup
      console.log('Friend request notification tapped:', data);
      break;
    case 'post_like':
      // Navigate to the specific post
      console.log('Post like notification tapped:', data);
      break;
    case 'post_comment':
      // Navigate to the specific post
      console.log('Post comment notification tapped:', data);
      break;
    default:
      console.log('Unknown notification type:', data);
  }
};
