import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export class SessionManager {
  // Check if user has a valid session
  static async hasValidSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session check error:', error);
        return false;
      }
      return !!session && !!session.user;
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  }

  // Get session expiry information
  static async getSessionInfo(): Promise<{
    isValid: boolean;
    expiresAt: string | null;
    timeUntilExpiry: number | null;
  }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return {
          isValid: false,
          expiresAt: null,
          timeUntilExpiry: null
        };
      }

      const expiresAt = new Date(session.expires_at! * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      return {
        isValid: timeUntilExpiry > 0,
        expiresAt: expiresAt.toISOString(),
        timeUntilExpiry: Math.max(0, timeUntilExpiry)
      };
    } catch (error) {
      console.error('Error getting session info:', error);
      return {
        isValid: false,
        expiresAt: null,
        timeUntilExpiry: null
      };
    }
  }

  // Store last login timestamp
  static async storeLastLoginTime(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem('last_login_time', timestamp);
    } catch (error) {
      console.error('Error storing last login time:', error);
    }
  }

  // Get last login timestamp
  static async getLastLoginTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('last_login_time');
    } catch (error) {
      console.error('Error getting last login time:', error);
      return null;
    }
  }

  // Store user preferences for faster loading
  static async storeUserPreferences(preferences: any): Promise<void> {
    try {
      await AsyncStorage.setItem('user_preferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Error storing user preferences:', error);
    }
  }

  // Get user preferences
  static async getUserPreferences(): Promise<any | null> {
    try {
      const prefs = await AsyncStorage.getItem('user_preferences');
      return prefs ? JSON.parse(prefs) : null;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  // Clear all stored session data
  static async clearSessionData(): Promise<void> {
    try {
      const promises = [
        AsyncStorage.removeItem('last_login_time'),
        AsyncStorage.removeItem('user_preferences'),
        AsyncStorage.removeItem('app_settings'),
        AsyncStorage.removeItem('user_has_used_app')
      ];

      // Use Promise.allSettled to prevent one failure from breaking the others
      const results = await Promise.allSettled(promises);
      
      // Log any failures but don't throw
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const keys = ['last_login_time', 'user_preferences', 'app_settings', 'user_has_used_app'];
          console.warn(`Failed to clear ${keys[index]}:`, result.reason);
        }
      });

      console.log('Session data cleared');
    } catch (error) {
      console.error('Error clearing session data:', error);
      // Don't throw the error to prevent crashes during logout
    }
  }

  // Mark user as having used the app
  static async markUserAsUsedApp(): Promise<void> {
    try {
      await AsyncStorage.setItem('user_has_used_app', 'true');
      console.log('Marked user as having used the app');
    } catch (error) {
      console.error('Error marking user as used app:', error);
    }
  }

  // Check if user has used the app before
  static async hasUserUsedApp(): Promise<boolean> {
    try {
      const hasUsed = await AsyncStorage.getItem('user_has_used_app');
      return hasUsed === 'true';
    } catch (error) {
      console.error('Error checking if user has used app:', error);
      return false;
    }
  }

  // Reset app state (for testing purposes)
  static async resetAppState(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(allKeys);
      console.log('App state reset completely');
    } catch (error) {
      console.error('Error resetting app state:', error);
    }
  }

  // Check if session will expire soon (within 1 hour)
  static async willExpireSoon(): Promise<boolean> {
    const sessionInfo = await this.getSessionInfo();
    if (!sessionInfo.isValid || !sessionInfo.timeUntilExpiry) {
      return false;
    }
    
    // Return true if session expires within 1 hour (3600000 ms)
    return sessionInfo.timeUntilExpiry < 3600000;
  }

  // Refresh session if needed
  static async refreshSessionIfNeeded(): Promise<boolean> {
    try {
      if (await this.willExpireSoon()) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('Session refresh error:', error);
          return false;
        }
        console.log('Session refreshed successfully');
        return true;
      }
      return true; // Session doesn't need refresh
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
  }
}
