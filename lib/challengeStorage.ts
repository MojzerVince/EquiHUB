import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveChallenge, ChallengeSession, UserBadge } from '../types/challengeTypes';

export class ChallengeStorageService {
  private static readonly ACTIVE_CHALLENGE_KEY = 'active_challenge';
  private static readonly USER_BADGES_KEY = 'user_badges';
  private static readonly CHALLENGE_SESSIONS_KEY = 'challenge_sessions';

  /**
   * Get user's active challenge
   */
  static async getActiveChallenge(userId: string): Promise<ActiveChallenge | null> {
    try {
      const key = `${this.ACTIVE_CHALLENGE_KEY}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting active challenge:', error);
      return null;
    }
  }

  /**
   * Save active challenge
   */
  static async saveActiveChallenge(userId: string, challenge: ActiveChallenge): Promise<boolean> {
    try {
      const key = `${this.ACTIVE_CHALLENGE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(challenge));
      return true;
    } catch (error) {
      console.error('Error saving active challenge:', error);
      return false;
    }
  }

  /**
   * Remove active challenge (when completed or abandoned)
   */
  static async removeActiveChallenge(userId: string): Promise<boolean> {
    try {
      const key = `${this.ACTIVE_CHALLENGE_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing active challenge:', error);
      return false;
    }
  }

  /**
   * Add a session to the active challenge
   */
  static async addChallengeSession(
    userId: string, 
    session: ChallengeSession
  ): Promise<boolean> {
    try {
      const activeChallenge = await this.getActiveChallenge(userId);
      if (!activeChallenge) return false;

      // Add session to challenge
      activeChallenge.sessions.push(session);
      
      // Update progress based on challenge unit
      if (activeChallenge.unit === 'km') {
        activeChallenge.progress += session.distance;
      } else if (activeChallenge.unit === 'hours') {
        activeChallenge.progress += session.duration / 60; // Convert minutes to hours
      } else if (activeChallenge.unit === 'sessions') {
        activeChallenge.progress += 1;
      } else if (activeChallenge.unit === 'minutes') {
        activeChallenge.progress += session.duration;
      }

      // Check if challenge is completed
      if (activeChallenge.progress >= activeChallenge.target) {
        activeChallenge.isCompleted = true;
        activeChallenge.completedDate = new Date().toISOString();
      }

      activeChallenge.lastUpdated = new Date().toISOString();

      // Save updated challenge
      return await this.saveActiveChallenge(userId, activeChallenge);
    } catch (error) {
      console.error('Error adding challenge session:', error);
      return false;
    }
  }

  /**
   * Get user's earned badges
   */
  static async getUserBadges(userId: string): Promise<UserBadge[]> {
    try {
      const key = `${this.USER_BADGES_KEY}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting user badges:', error);
      return [];
    }
  }

  /**
   * Add a new badge to user's collection
   */
  static async addUserBadge(userId: string, badge: UserBadge): Promise<boolean> {
    try {
      const badges = await this.getUserBadges(userId);
      
      // Check if badge already exists
      const existingBadge = badges.find(b => b.id === badge.id);
      if (existingBadge) return true; // Already has this badge

      badges.push(badge);
      
      const key = `${this.USER_BADGES_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(badges));
      return true;
    } catch (error) {
      console.error('Error adding user badge:', error);
      return false;
    }
  }

  /**
   * Get challenge progress summary
   */
  static async getChallengeProgress(userId: string): Promise<{
    hasActiveChallenge: boolean;
    progress: number;
    target: number;
    percentage: number;
    unit: string;
    daysRemaining?: number;
  }> {
    try {
      const activeChallenge = await this.getActiveChallenge(userId);
      
      if (!activeChallenge) {
        return {
          hasActiveChallenge: false,
          progress: 0,
          target: 0,
          percentage: 0,
          unit: '',
        };
      }

      const percentage = Math.min((activeChallenge.progress / activeChallenge.target) * 100, 100);

      return {
        hasActiveChallenge: true,
        progress: activeChallenge.progress,
        target: activeChallenge.target,
        percentage,
        unit: activeChallenge.unit,
      };
    } catch (error) {
      console.error('Error getting challenge progress:', error);
      return {
        hasActiveChallenge: false,
        progress: 0,
        target: 0,
        percentage: 0,
        unit: '',
      };
    }
  }

  /**
   * Update challenge progress manually (for testing or manual adjustments)
   */
  static async updateChallengeProgress(
    userId: string, 
    progressToAdd: number
  ): Promise<boolean> {
    try {
      const activeChallenge = await this.getActiveChallenge(userId);
      if (!activeChallenge) return false;

      activeChallenge.progress += progressToAdd;
      
      // Check if challenge is completed
      if (activeChallenge.progress >= activeChallenge.target) {
        activeChallenge.isCompleted = true;
        activeChallenge.completedDate = new Date().toISOString();
      }

      activeChallenge.lastUpdated = new Date().toISOString();

      return await this.saveActiveChallenge(userId, activeChallenge);
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      return false;
    }
  }

  /**
   * Get all challenge sessions for the active challenge
   */
  static async getChallengeSessions(userId: string): Promise<ChallengeSession[]> {
    try {
      const activeChallenge = await this.getActiveChallenge(userId);
      return activeChallenge?.sessions || [];
    } catch (error) {
      console.error('Error getting challenge sessions:', error);
      return [];
    }
  }

  /**
   * Clear all challenge data (for testing or reset)
   */
  static async clearAllChallengeData(userId: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(`${this.ACTIVE_CHALLENGE_KEY}_${userId}`);
      await AsyncStorage.removeItem(`${this.USER_BADGES_KEY}_${userId}`);
      await AsyncStorage.removeItem(`${this.CHALLENGE_SESSIONS_KEY}_${userId}`);
      return true;
    } catch (error) {
      console.error('Error clearing challenge data:', error);
      return false;
    }
  }
}
