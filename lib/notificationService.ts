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
      console.log(`🔔 DEBUG: Saving push token for user: ${userId}`);
      console.log(`🔔 DEBUG: Token: ${token.substring(0, 20)}...`);
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // Get device information
      const deviceInfo = {
        isDevice: Device.isDevice,
        deviceName: Device.deviceName || 'Unknown Device',
        platform: Platform.OS,
        platformVersion: Platform.Version,
        timestamp: Date.now(),
      };
      
      console.log(`🔔 DEBUG: Device info:`, deviceInfo);
      
      // Debug: Let's see ALL tokens in the database
      const { data: allTokensInDB } = await supabase
        .from('user_push_tokens')
        .select('user_id, push_token, is_active, created_at')
        .order('created_at', { ascending: false });
      
      console.log(`🔔 DEBUG: ALL tokens in database:`, allTokensInDB);
      console.log(`🔔 DEBUG: Looking for user_id: ${userId}`);
      
      // First, check if this exact combination already exists
      const { data: existingToken } = await supabase
        .from('user_push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('push_token', token)
        .single();
      
      if (existingToken) {
        console.log('🔔 DEBUG: Token already exists, updating...');
        // Update the existing token
        const { error: updateError } = await supabase
          .from('user_push_tokens')
          .update({
            device_info: deviceInfo,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('push_token', token);
        
        if (updateError) {
          console.error('🔔 DEBUG: Error updating existing push token:', updateError);
        } else {
          console.log('✅ Push token updated successfully');
        }
        return;
      }
      
      // Deactivate any other tokens for this user (to avoid multiple active tokens)
      const { error: deactivateError } = await supabase
        .from('user_push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('push_token', token);
      
      if (deactivateError) {
        console.warn('🔔 DEBUG: Warning deactivating old tokens:', deactivateError);
      }
      
      // Then insert the new token
      const { error } = await supabase
        .from('user_push_tokens')
        .insert({
          user_id: userId,
          push_token: token,
          device_info: deviceInfo,
          is_active: true,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('🔔 DEBUG: Error inserting push token:', error);
      } else {
        console.log('✅ Push token saved successfully');
      }
    } catch (error) {
      console.error('🔔 DEBUG: Error saving push token:', error);
    }
  }  static async sendPushNotification(
    recipientUserId: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<boolean> {
    try {
      console.log(`🔔 DEBUG: Attempting to send push notification to user: ${recipientUserId}`);
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // Debug: Check current auth context
      const { data: { session } } = await supabase.auth.getSession();
      console.log(`🔔 DEBUG: Current auth session user:`, session?.user?.id || 'No session');
      
      // First, let's check all tokens for this user (with debug info)
      const { data: allTokens, error: debugError } = await supabase
        .from('user_push_tokens')
        .select('*')
        .eq('user_id', recipientUserId);
      
      console.log(`🔔 DEBUG: Found ${allTokens?.length || 0} total tokens for user ${recipientUserId}:`, allTokens);
      console.log(`🔔 DEBUG: Debug query error:`, debugError);
      
      // Let's also try to get tokens without user_id filter to see if RLS is blocking
      const { data: allTokensNoFilter, error: noFilterError } = await supabase
        .from('user_push_tokens')
        .select('user_id, push_token, is_active')
        .limit(10);
      
      console.log(`🔔 DEBUG: All tokens in DB (no filter):`, allTokensNoFilter);
      console.log(`🔔 DEBUG: No filter query error:`, noFilterError);
      
      // Try using RPC or a different approach - let's check if we can find the token via a more direct query
      // First, let's comment out the RPC call since we haven't created that function yet
      // const { data: tokensByUser } = await supabase
      //   .rpc('get_user_push_token', { target_user_id: recipientUserId })
      //   .single();
      
      // console.log(`🔔 DEBUG: RPC token result:`, tokensByUser);
      
      // Try using RPC function with elevated privileges to bypass RLS
      console.log(`🔔 DEBUG: Trying RPC function to bypass RLS...`);
      
      const { data: rpcTokenData, error: rpcError } = await supabase
        .rpc('get_user_push_token', { target_user_id: recipientUserId });
      
      console.log(`🔔 DEBUG: RPC token result:`, rpcTokenData);
      console.log(`🔔 DEBUG: RPC error:`, rpcError);
      
      if (rpcTokenData && rpcTokenData.length > 0) {
        const pushToken = rpcTokenData[0].push_token;
        console.log(`🔔 DEBUG: Found token via RPC: ${pushToken.substring(0, 20)}...`);
        
        // Validate and send notification using RPC result
        if (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken[')) {
          const message = {
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data || {},
            channelId: 'default',
            priority: 'high',
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
          console.log('🔔 DEBUG: Push notification response (RPC path):', result);

          if (response.ok && result.data && result.data[0] && result.data[0].status === 'ok') {
            console.log('✅ Push notification sent successfully via RPC path');
            return true;
          }
        }
      }
      
      // Let's try a service role query to bypass RLS
      console.log(`🔔 DEBUG: Trying service role query to bypass RLS...`);
      
      // Try getting tokens with a different auth context
      const { data: alternativeTokens, error: altError } = await supabase
        .from('user_push_tokens')
        .select('push_token, is_active, user_id')
        .eq('user_id', recipientUserId)
        .eq('is_active', true);
        
      console.log(`🔔 DEBUG: Alternative query result:`, alternativeTokens);
      console.log(`🔔 DEBUG: Alternative query error:`, altError);
      
      if (alternativeTokens && alternativeTokens.length > 0) {
        const pushToken = alternativeTokens[0].push_token;
        console.log(`🔔 DEBUG: Found token via alternative query: ${pushToken.substring(0, 20)}...`);
        
        // Validate token format (Expo push tokens should start with ExponentPushToken)
        if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
          console.error('🔔 DEBUG: Invalid push token format:', pushToken.substring(0, 30));
          return false;
        }

        // Send the push notification using Expo's push service
        const message = {
          to: pushToken,
          sound: 'default',
          title: title,
          body: body,
          data: data || {},
          channelId: 'default',
          priority: 'high',
        };

        console.log('🔔 DEBUG: Sending push notification via alternative path with payload:', {
          to: pushToken.substring(0, 20) + '...',
          title,
          body,
          data: data || {}
        });

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
        console.log('🔔 DEBUG: Push notification response (alternative path):', result);

        if (response.ok && result.data && result.data[0] && result.data[0].status === 'ok') {
          console.log('✅ Push notification sent successfully via alternative path');
          return true;
        } else {
          console.error('❌ Failed to send push notification via alternative path:', result);
          return false;
        }
      }
      
      // Also check if this user exists in profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', recipientUserId)
        .single();
      
      console.log(`🔔 DEBUG: Profile data for user ${recipientUserId}:`, profileData);
      
      // Get the recipient's active push token from the database
      const { data: tokenData, error } = await supabase
        .from('user_push_tokens')
        .select('push_token, is_active')
        .eq('user_id', recipientUserId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('🔔 DEBUG: Database error getting push token:', error);
        return false;
      }

      if (!tokenData || tokenData.length === 0) {
        console.log('🔔 DEBUG: No active push token found for user:', recipientUserId);
        return false;
      }

      const pushToken = tokenData[0].push_token;
      console.log(`🔔 DEBUG: Found push token: ${pushToken.substring(0, 20)}...`);

      // Validate token format (Expo push tokens should start with ExponentPushToken)
      if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
        console.error('🔔 DEBUG: Invalid push token format:', pushToken.substring(0, 30));
        return false;
      }

      // Send the push notification using Expo's push service
      const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
        channelId: 'default',
        priority: 'high',
      };

      console.log('🔔 DEBUG: Sending push notification with payload:', {
        to: pushToken.substring(0, 20) + '...',
        title,
        body,
        data: data || {}
      });

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
      console.log('🔔 DEBUG: Expo push service response:', result);
      
      // Check for successful response
      if (response.ok && result.data && result.data.status === 'ok') {
        console.log('✅ Push notification sent successfully');
        return true;
      } else if (result.data && result.data.status === 'error') {
        console.error('❌ Expo push service error:', result.data.message || result.data.details);
        return false;
      } else {
        console.error('❌ Unexpected response from Expo push service:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
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
