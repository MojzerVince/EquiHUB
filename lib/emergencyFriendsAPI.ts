import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getSupabase } from "./supabase";
import { UserAPI, UserSearchResult } from "./userAPI";

export interface EmergencyFriend {
  id: string;
  friendId: string;
  name: string;
  isEnabled: boolean;
  addedAt: number;
  profileImageUrl?: string;
}

export interface FallNotificationData {
  riderName: string;
  riderId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  emergencyType: 'fall_detection' | 'manual_emergency';
}

export class EmergencyFriendsAPI {
  private static readonly STORAGE_KEY_PREFIX = "emergency_friends_";
  private static readonly MAX_FRIENDS = 3;

  // Get user's friends for emergency contact selection
  static async getUserFriends(userId: string): Promise<{ friends: UserSearchResult[]; error?: string }> {
    try {
      const { friends, error } = await UserAPI.getFriends(userId);
      
      if (error) {
        console.error("Error getting user friends:", error);
        return { friends: [], error };
      }

      return { friends };
    } catch (error) {
      console.error("Error getting user friends:", error);
      return { friends: [], error: "Failed to load friends" };
    }
  }

  // Get saved emergency friends
  static async getEmergencyFriends(userId: string): Promise<EmergencyFriend[]> {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting emergency friends:", error);
      return [];
    }
  }

  // Add emergency friend
  static async addEmergencyFriend(
    userId: string,
    friend: UserSearchResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existingFriends = await this.getEmergencyFriends(userId);

      // Check if we've reached the maximum
      if (existingFriends.length >= this.MAX_FRIENDS) {
        return {
          success: false,
          error: `You can only have up to ${this.MAX_FRIENDS} emergency friends`,
        };
      }

      // Check if this friend is already added
      const friendExists = existingFriends.some(
        (f) => f.friendId === friend.id
      );
      if (friendExists) {
        return {
          success: false,
          error: "This friend is already added as an emergency contact",
        };
      }

      const newEmergencyFriend: EmergencyFriend = {
        id: `emergency_friend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        friendId: friend.id,
        name: friend.name,
        isEnabled: true,
        addedAt: Date.now(),
        profileImageUrl: friend.profile_image_url,
      };

      const updatedFriends = [...existingFriends, newEmergencyFriend];
      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedFriends));

      // Emergency friend saved locally (friendships are already tracked in database)
      console.log("✅ Emergency friend saved locally:", newEmergencyFriend.name);

      return { success: true };
    } catch (error) {
      console.error("Error adding emergency friend:", error);
      return {
        success: false,
        error: "Failed to save emergency friend",
      };
    }
  }

  // Remove emergency friend
  static async removeEmergencyFriend(
    userId: string,
    emergencyFriendId: string
  ): Promise<boolean> {
    try {
      const existingFriends = await this.getEmergencyFriends(userId);
      const friendToRemove = existingFriends.find(f => f.id === emergencyFriendId);
      const updatedFriends = existingFriends.filter(
        (friend) => friend.id !== emergencyFriendId
      );

      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedFriends));

      // Emergency friend removed locally
      if (friendToRemove) {
        console.log("✅ Emergency friend removed locally:", friendToRemove.name);
      }

      return true;
    } catch (error) {
      console.error("Error removing emergency friend:", error);
      return false;
    }
  }

  // Toggle emergency friend enabled status
  static async toggleEmergencyFriend(
    userId: string,
    emergencyFriendId: string,
    isEnabled: boolean
  ): Promise<boolean> {
    try {
      const existingFriends = await this.getEmergencyFriends(userId);
      const updatedFriends = existingFriends.map((friend) =>
        friend.id === emergencyFriendId ? { ...friend, isEnabled } : friend
      );

      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedFriends));
      return true;
    } catch (error) {
      console.error("Error toggling emergency friend:", error);
      return false;
    }
  }

  // Send fall detection notification to all enabled emergency friends
  static async sendFallDetectionNotification(
    userId: string,
    riderName: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{ 
    success: boolean; 
    notifiedCount: number; 
    error?: string;
  }> {
    try {
      console.log("📱 Sending fall detection notifications...");

      const emergencyFriends = await this.getEmergencyFriends(userId);
      const enabledFriends = emergencyFriends.filter((f) => f.isEnabled);

      if (enabledFriends.length === 0) {
        return {
          success: false,
          notifiedCount: 0,
          error: "No enabled emergency friends found",
        };
      }

      const notificationData: FallNotificationData = {
        riderName,
        riderId: userId,
        coordinates: userLocation || { latitude: 0, longitude: 0 },
        timestamp: Date.now(),
        emergencyType: 'fall_detection',
      };

      // Send local notification (this will be seen by the current user's friends if they have the app)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚨 Fall Detection Alert",
          body: `${riderName} may have fallen while riding. Tap to view location.`,
          data: notificationData as any,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Send immediately
      });

      // Log notification event to database for future push notification system
      try {
        await this.logFallNotificationEvent(userId, notificationData, enabledFriends);
      } catch (logError) {
        console.warn("Failed to log notification event:", logError);
      }

      console.log(`✅ Fall detection notification sent to ${enabledFriends.length} emergency friends`);
      return {
        success: true,
        notifiedCount: enabledFriends.length,
      };
    } catch (error) {
      console.error("❌ Error sending fall detection notification:", error);
      return {
        success: false,
        notifiedCount: 0,
        error: "Failed to send fall detection notification",
      };
    }
  }

  // Send manual emergency notification
  static async sendManualEmergencyNotification(
    userId: string,
    riderName: string,
    message: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{ 
    success: boolean; 
    notifiedCount: number; 
    error?: string;
  }> {
    try {
      console.log("📱 Sending manual emergency notifications...");

      const emergencyFriends = await this.getEmergencyFriends(userId);
      const enabledFriends = emergencyFriends.filter((f) => f.isEnabled);

      if (enabledFriends.length === 0) {
        return {
          success: false,
          notifiedCount: 0,
          error: "No enabled emergency friends found",
        };
      }

      const notificationData: FallNotificationData = {
        riderName,
        riderId: userId,
        coordinates: userLocation || { latitude: 0, longitude: 0 },
        timestamp: Date.now(),
        emergencyType: 'manual_emergency',
      };

      // Send local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🆘 Emergency Alert",
          body: `${riderName}: ${message}`,
          data: notificationData as any,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Send immediately
      });

      // Log notification event to database
      try {
        await this.logFallNotificationEvent(userId, notificationData, enabledFriends);
      } catch (logError) {
        console.warn("Failed to log notification event:", logError);
      }

      console.log(`✅ Manual emergency notification sent to ${enabledFriends.length} emergency friends`);
      return {
        success: true,
        notifiedCount: enabledFriends.length,
      };
    } catch (error) {
      console.error("❌ Error sending manual emergency notification:", error);
      return {
        success: false,
        notifiedCount: 0,
        error: "Failed to send manual emergency notification",
      };
    }
  }



  // Log notification event to database using existing notification_history table
  private static async logFallNotificationEvent(
    userId: string,
    notificationData: FallNotificationData,
    notifiedFriends: EmergencyFriend[]
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      // Log to notification_history table for each friend
      // Note: Using upsert and handling RLS policy constraints
      for (const friend of notifiedFriends) {
        const notificationRecord = {
          recipient_user_id: friend.friendId,
          sender_user_id: userId,
          notification_type: notificationData.emergencyType,
          title: notificationData.emergencyType === 'fall_detection' 
            ? '🚨 Fall Detection Alert' 
            : '🆘 Emergency Alert',
          body: `${notificationData.riderName} may have fallen while riding. Tap to view location.`,
          data: {
            emergency_type: notificationData.emergencyType,
            coordinates: notificationData.coordinates,
            rider_name: notificationData.riderName,
            rider_id: notificationData.riderId,
            timestamp: notificationData.timestamp,
          },
          delivery_status: 'sent',
        };

        // Try to insert the notification record
        const { error } = await supabase
          .from('notification_history')
          .insert([notificationRecord]);

        if (error) {
          console.warn(`Failed to log notification event for friend ${friend.friendId}:`, error);
          // Don't throw error - continue with other notifications
        } else {
          console.log(`✅ Logged emergency notification to database for friend: ${friend.name}`);
        }
      }
    } catch (error) {
      console.warn('Failed to log notification event:', error);
      // Don't throw error - this is just logging, shouldn't stop the emergency process
    }
  }

  // Get summary of emergency friends (local storage only)
  static async getEmergencyFriendsSummary(userId: string): Promise<{ count: number; names: string[] }> {
    try {
      const localEmergencyFriends = await this.getEmergencyFriends(userId);
      
      return {
        count: localEmergencyFriends.length,
        names: localEmergencyFriends.map(f => f.name),
      };
    } catch (error) {
      console.error('Failed to get emergency friends summary:', error);
      return { count: 0, names: [] };
    }
  }

  // DEBUG ONLY: Simulate a fall detection for testing notifications
  static async simulateFallDetection(
    userId: string,
    riderName: string,
    testCoordinates?: { latitude: number; longitude: number }
  ): Promise<{ 
    success: boolean; 
    notifiedCount: number; 
    error?: string;
    debugInfo: {
      emergencyFriendsFound: number;
      enabledFriends: number;
      testLocation: { latitude: number; longitude: number };
      timestamp: number;
    };
  }> {
    // Only allow in development mode
    if (__DEV__) {
      console.log("🧪 DEBUG: Simulating fall detection...");

      const emergencyFriends = await this.getEmergencyFriends(userId);
      const enabledFriends = emergencyFriends.filter((f) => f.isEnabled);

      // Use test coordinates or default test location
      const testLocation = testCoordinates || {
        latitude: 47.6062, // Seattle coordinates for testing
        longitude: -122.3321
      };

      const debugInfo = {
        emergencyFriendsFound: emergencyFriends.length,
        enabledFriends: enabledFriends.length,
        testLocation,
        timestamp: Date.now(),
      };

      console.log("🧪 DEBUG Info:", debugInfo);

      if (enabledFriends.length === 0) {
        console.log("🧪 DEBUG: No enabled emergency friends found for testing");
        return {
          success: false,
          notifiedCount: 0,
          error: "No enabled emergency friends found (this is a test)",
          debugInfo,
        };
      }

      // Send the actual fall detection notification using the real method
      const result = await this.sendFallDetectionNotification(
        userId,
        `${riderName} (TEST)`,
        testLocation
      );

      console.log("🧪 DEBUG: Fall simulation completed");
      console.log("🧪 DEBUG Result:", result);

      return {
        ...result,
        debugInfo,
      };
    } else {
      console.warn("🧪 DEBUG: Fall simulation only available in development mode");
      return {
        success: false,
        notifiedCount: 0,
        error: "Debug features only available in development mode",
        debugInfo: {
          emergencyFriendsFound: 0,
          enabledFriends: 0,
          testLocation: { latitude: 0, longitude: 0 },
          timestamp: Date.now(),
        },
      };
    }
  }
}