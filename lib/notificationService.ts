import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: 'friend_request' | 'post_like' | 'post_comment' | 'emergency_alert';
  senderId: string;
  senderName: string;
  message: string;
  // Emergency alert specific data
  emergency_type?: 'fall_detection' | 'manual_emergency';
  coordinates?: { latitude: number; longitude: number };
  rider_id?: string;
  timestamp?: number;
}

export class NotificationService {
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    console.log('🔔 DEBUG: Starting registerForPushNotificationsAsync');
    let token = null;
    
    console.log('🔔 DEBUG: Device check:', {
      isDevice: Device.isDevice,
      deviceName: Device.deviceName,
      platform: Platform.OS,
      osVersion: Device.osVersion
    });
    
    if (Platform.OS === 'android') {
      console.log('🔔 DEBUG: Setting up Android notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      console.log('✅ DEBUG: Android notification channel set up');
    }

    if (Device.isDevice) {
      console.log('🔔 DEBUG: Device is physical device, checking permissions...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('🔔 DEBUG: Existing permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('🔔 DEBUG: Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('🔔 DEBUG: Permission request result:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ DEBUG: Failed to get push token - permissions not granted:', finalStatus);
        return null;
      }
      
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        console.log('🔔 DEBUG: Getting Expo push token with project ID:', projectId);
        
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });
        
        token = tokenResponse.data;
        console.log('✅ DEBUG: Successfully got push token:', token);
        console.log('🔔 DEBUG: Token response details:', {
          type: tokenResponse.type,
          data: tokenResponse.data
        });
      } catch (error) {
        console.error('❌ DEBUG: Error getting push token:', error);
        if (error instanceof Error) {
          console.error('❌ DEBUG: Error details:', {
            message: error.message,
            stack: error.stack
          });
        }
      }
    } else {
      console.log('⚠️ DEBUG: Not a physical device - push notifications not available');
    }

    console.log('🔔 DEBUG: registerForPushNotificationsAsync completed, token:', token ? 'RECEIVED' : 'NULL');
    return token;
  }

  static async savePushToken(userId: string, token: string): Promise<void> {
    try {
      console.log('🔔 DEBUG: Starting savePushToken for user:', userId);
      console.log('🔔 DEBUG: Token to save:', token.substring(0, 30) + '...');
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // First, check if token already exists
      console.log('🔍 DEBUG: Checking for existing token...');
      const { data: existingTokens, error: checkError } = await supabase
        .from('user_push_tokens')
        .select('*')
        .eq('user_id', userId);
      
      console.log('🔍 DEBUG: Existing tokens check result:', { 
        count: existingTokens?.length || 0, 
        error: checkError,
        tokens: existingTokens?.map((t: any) => ({ id: t.id, token: t.push_token.substring(0, 20) + '...' }))
      });
      
      // Delete any existing tokens for this user
      console.log('🔄 DEBUG: Deleting existing tokens for user...');
      const { error: deleteError } = await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('⚠️ DEBUG: Error deleting existing tokens:', deleteError);
      } else {
        console.log('✅ DEBUG: Existing tokens deleted successfully');
      }
      
      // Then insert the new token
      console.log('🔄 DEBUG: Inserting new token...');
      const { data: insertData, error: insertError } = await supabase
        .from('user_push_tokens')
        .insert({
          user_id: userId,
          push_token: token,
          updated_at: new Date().toISOString(),
        })
        .select();

      console.log('🔔 DEBUG: Insert result:', { 
        data: insertData, 
        error: insertError,
        success: !insertError
      });

      if (insertError) {
        console.error('❌ DEBUG: Error inserting push token:', insertError);
        console.error('❌ DEBUG: Insert error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
      } else {
        console.log('✅ DEBUG: Push token saved successfully to database');
      }
    } catch (error) {
      console.error('❌ DEBUG: Exception in savePushToken:', error);
    }
  }

  // Check if user has a push token registered
  static async checkUserHasPushToken(userId: string): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { data: tokenData, error } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', userId)
        .single();

      return !error && !!tokenData?.push_token;
    } catch (error) {
      console.error(`Error checking push token for user: ${userId}`, error);
      return false;
    }
  }

  static async sendPushNotification(
    recipientUserId: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<boolean> {
    try {
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
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
    case 'emergency_alert':
      // Handle emergency alert tap - show fall details modal
      console.log('Emergency alert notification tapped:', data);
      // This will be handled by the app's notification response listener
      // to show the FallDetailsModal with the emergency data
      break;
    default:
      console.log('Unknown notification type:', data);
  }
};
