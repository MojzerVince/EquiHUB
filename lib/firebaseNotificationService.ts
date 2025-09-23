import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

export interface NotificationData {
  type?: 'friend_request' | 'post_like' | 'post_comment' | 'emergency_alert' | 'fall_detected' | 'emergency' | 'general';
  senderUserId?: string;
  fallLocation?: string;
  fallSeverity?: string;
  actionUrl?: string;
  [key: string]: any;
}

export class FirebaseNotificationService {
  private static isInitialized = false;

  /**
   * Initialize Firebase messaging and request permissions
   */
  static async initialize(): Promise<string | null> {
    try {
      if (this.isInitialized) {
        console.log('Firebase notification service already initialized');
        return await this.getToken();
      }

      console.log('Initializing Firebase notification service...');

      // Request permission for iOS
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('Push notification permission denied on iOS');
          return null;
        }
      }

      // Get FCM token
      const token = await this.getToken();
      if (!token) {
        console.log('Failed to get FCM token');
        return null;
      }

      // Set up message handlers
      this.setupMessageHandlers();

      // Configure notification display
      await this.configureNotifications();

      this.isInitialized = true;
      console.log('Firebase notification service initialized successfully');
      return token;

    } catch (error) {
      console.error('Error initializing Firebase notifications:', error);
      return null;
    }
  }

  /**
   * Get the current FCM token
   */
  static async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Setup message handlers for different app states
   */
  private static setupMessageHandlers(): void {
    // Handle messages when app is in background
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message received:', remoteMessage);
      await this.handleBackgroundMessage(remoteMessage);
    });

    // Handle messages when app is in foreground
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage);
      await this.handleForegroundMessage(remoteMessage);
    });

    // Handle notification opened when app was closed/background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // Handle notification that opened the app from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from quit state by notification:', remoteMessage);
          this.handleNotificationTap(remoteMessage);
        }
      });

    // Handle token refresh
    messaging().onTokenRefresh(async (token) => {
      console.log('FCM token refreshed:', token);
      await this.updateTokenInDatabase(token);
    });
  }

  /**
   * Configure notification display settings
   */
  private static async configureNotifications(): Promise<void> {
    // Configure how notifications are displayed
    await Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        const isEmergency = data?.type === 'fall_detected' || data?.type === 'emergency' || data?.type === 'emergency_alert';

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: isEmergency,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: isEmergency 
            ? Notifications.AndroidNotificationPriority.MAX 
            : Notifications.AndroidNotificationPriority.HIGH,
        };
      },
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergency Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
  }

  /**
   * Handle background messages
   */
  private static async handleBackgroundMessage(remoteMessage: any): Promise<void> {
    try {
      console.log('Processing background message:', remoteMessage);
      
      // Background messages are automatically displayed by Firebase
      // We just need to handle any data processing here
      const data = remoteMessage.data;
      if (data?.type === 'fall_detected' || data?.type === 'emergency') {
        // Could store in local database for when app opens
        console.log('Emergency alert received in background');
      }
    } catch (error) {
      console.error('Error handling background message:', error);
    }
  }

  /**
   * Handle foreground messages
   */
  private static async handleForegroundMessage(remoteMessage: any): Promise<void> {
    try {
      console.log('Processing foreground message:', remoteMessage);
      
      const { notification, data } = remoteMessage;
      
      // Show local notification since Firebase doesn't show them in foreground
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification?.title || 'EquiHUB',
          body: notification?.body || 'New notification',
          data: data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: data?.type === 'fall_detected' ? 'emergency' : 'default',
        },
        trigger: null, // Show immediately
      });

    } catch (error) {
      console.error('Error handling foreground message:', error);
    }
  }

  /**
   * Handle notification tap
   */
  private static handleNotificationTap(remoteMessage: any): void {
    try {
      console.log('User tapped notification:', remoteMessage);
      
      const data = remoteMessage.data;
      
      // Navigate based on notification type
      if (data?.type === 'fall_detected' || data?.type === 'emergency') {
        // This will be handled by the navigation system
        // The data will be available through notification response listeners
        console.log('Emergency notification tapped - should show fall details');
      }
      
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  }

  /**
   * Register push token for a user
   */
  static async registerToken(userId: string): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        console.log('No FCM token available for registration');
        return false;
      }

      return await this.updateTokenInDatabase(token, userId);
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }

  /**
   * Update token in Supabase database
   */
  private static async updateTokenInDatabase(token: string, userId?: string): Promise<boolean> {
    try {
      const supabase = getSupabase();
      
      // If no userId provided, try to get current user
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No authenticated user for token update');
          return false;
        }
        userId = user.id;
      }

      console.log('Updating push token in database for user:', userId);

      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error updating push token in database:', error);
        return false;
      }

      console.log('Push token updated successfully in database');
      return true;

    } catch (error) {
      console.error('Error updating token in database:', error);
      return false;
    }
  }

  /**
   * Send push notification to a user
   */
  static async sendPushNotification(
    recipientUserId: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<boolean> {
    try {
      console.log('Sending push notification:', { recipientUserId, title });

      const supabase = getSupabase();
      
      // Get the recipient's push token
      const { data: tokenData, error } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', recipientUserId)
        .single();

      if (error || !tokenData?.push_token) {
        console.log('No push token found for user:', recipientUserId);
        return false;
      }

      // Determine notification channel and priority
      const isEmergency = data?.type === 'fall_detected' || data?.type === 'emergency' || data?.type === 'emergency_alert';
      const channelId = isEmergency ? 'emergency' : 'default';

      // Send notification using Expo's push service
      const message = {
        to: tokenData.push_token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
        channelId: channelId,
        priority: isEmergency ? 'high' : 'normal',
        badge: isEmergency ? 1 : undefined,
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
      
      if (result.data?.[0]?.status === 'ok') {
        console.log('Push notification sent successfully');
        
        // Log the notification in database
        await this.logNotification(recipientUserId, title, body, data);
        
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

  /**
   * Log notification in database for tracking
   */
  private static async logNotification(
    recipientUserId: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<void> {
    try {
      const supabase = getSupabase();
      
      await supabase
        .from('notification_history')
        .insert({
          recipient_user_id: recipientUserId,
          sender_user_id: data?.senderUserId,
          title: title,
          message: body,
          notification_type: data?.type || 'general',
          notification_data: data ? JSON.stringify(data) : null,
          sent_at: new Date().toISOString(),
        });

    } catch (error) {
      console.error('Error logging notification:', error);
      // Don't throw - logging failure shouldn't break notification sending
    }
  }

  /**
   * Send emergency fall alert
   */
  static async sendEmergencyAlert(
    senderUserId: string,
    recipientUserId: string,
    fallLocation?: string,
    fallSeverity?: string
  ): Promise<boolean> {
    const title = '🚨 Emergency: Fall Detected';
    const body = `Your friend may have had a fall${fallLocation ? ` at ${fallLocation}` : ''}. Tap to view details.`;
    
    const data: NotificationData = {
      type: 'fall_detected',
      senderUserId: senderUserId,
      fallLocation: fallLocation,
      fallSeverity: fallSeverity,
      actionUrl: '/fall-details',
    };

    return await this.sendPushNotification(recipientUserId, title, body, data);
  }
}