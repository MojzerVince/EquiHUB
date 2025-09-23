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

      // Sync to database for push notification functionality
      try {
        await this.syncEmergencyFriendToDatabase(userId, newEmergencyFriend);
      } catch (dbError) {
        console.warn("Failed to sync emergency friend to database:", dbError);
        // Don't fail the entire operation if database sync fails
      }

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

      // Remove from database if it exists
      if (friendToRemove) {
        try {
          await this.removeEmergencyFriendFromDatabase(userId, friendToRemove.friendId);
        } catch (dbError) {
          console.warn("Failed to remove emergency friend from database:", dbError);
          // Don't fail the entire operation if database removal fails
        }
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

  // Sync emergency friend to database for push notification functionality
  private static async syncEmergencyFriendToDatabase(
    userId: string,
    emergencyFriend: EmergencyFriend
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('emergency_friends')
        .upsert({
          user_id: userId,
          friend_id: emergencyFriend.friendId,
          friend_name: emergencyFriend.name,
          is_enabled: emergencyFriend.isEnabled,
          created_at: new Date(emergencyFriend.addedAt).toISOString(),
        });

      if (error) {
        console.error('Database sync error:', error);
        throw error;
      }

      console.log('✅ Emergency friend synced to database:', emergencyFriend.name);
    } catch (error) {
      console.error('Failed to sync emergency friend to database:', error);
      throw error;
    }
  }

  // Remove emergency friend from database
  private static async removeEmergencyFriendFromDatabase(
    userId: string,
    friendId: string
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('emergency_friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      if (error) {
        console.error('Database removal error:', error);
        throw error;
      }

      console.log('✅ Emergency friend removed from database:', friendId);
    } catch (error) {
      console.error('Failed to remove emergency friend from database:', error);
      throw error;
    }
  }

  // Log notification event to database for analytics and future push notification system
  private static async logFallNotificationEvent(
    userId: string,
    notificationData: FallNotificationData,
    notifiedFriends: EmergencyFriend[]
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('emergency_notifications_log')
        .insert({
          user_id: userId,
          rider_name: notificationData.riderName,
          emergency_type: notificationData.emergencyType,
          coordinates: notificationData.coordinates,
          timestamp: new Date(notificationData.timestamp).toISOString(),
          notified_friends: notifiedFriends.map(f => ({
            friend_id: f.friendId,
            friend_name: f.name,
          })),
          notification_method: 'local_notification',
          success: true,
        });

      if (error) {
        console.error('Failed to log notification event:', error);
        throw error;
      }

      console.log('✅ Notification event logged to database');
    } catch (error) {
      console.error('Failed to log notification event:', error);
      throw error;
    }
  }

  // Sync all local emergency friends to database
  static async syncAllEmergencyFriendsToDatabase(userId: string): Promise<void> {
    try {
      const localEmergencyFriends = await this.getEmergencyFriends(userId);
      
      for (const friend of localEmergencyFriends) {
        try {
          await this.syncEmergencyFriendToDatabase(userId, friend);
        } catch (error) {
          console.warn(`Failed to sync emergency friend ${friend.name}:`, error);
        }
      }
      
      console.log(`✅ Synced ${localEmergencyFriends.length} emergency friends to database`);
    } catch (error) {
      console.error('Failed to sync emergency friends to database:', error);
      throw error;
    }
  }
}