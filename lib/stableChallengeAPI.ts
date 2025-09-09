import { ActiveStableChallenge, StableChallenge, StableChallengeReward, StableParticipant } from '../types/challengeTypes';

export class StableChallengeAPI {
  /**
   * Initialize automatic stable challenge for a stable
   * This creates a new monthly challenge that auto-enrolls all stable members
   */
  static async initializeMonthlyStableChallenge(stableId: string, stableName: string): Promise<StableChallenge | null> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const challengeId = `stable_monthly_${stableId}_${now.getFullYear()}_${now.getMonth() + 1}`;

      const stableChallenge: StableChallenge = {
        id: challengeId,
        title: `${stableName} Monthly Challenge`,
        description: `Work together as a stable to reach this month's distance goal! Every ride counts towards your stable's total.`,
        icon: '🏆',
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
        isActive: true,
        stableId: stableId,
        stableName: stableName,
        targetDistance: 500, // Default 500km/month for stable
        unit: 'km',
        participants: [], // Will be populated with stable members
        currentProgress: 0,
        leaderboard: [],
        monthlyReset: true,
        rewards: this.getDefaultStableRewards()
      };

      // Auto-enroll all stable members
      const stableMembers = await this.getStableMembers(stableId);
      stableChallenge.participants = stableMembers.map(member => member.userId);
      stableChallenge.leaderboard = stableMembers.map(member => ({
        userId: member.userId,
        userName: member.userName,
        userAvatar: member.userAvatar,
        contribution: 0,
        lastActivityDate: now.toISOString(),
        joinDate: now.toISOString()
      }));

      return stableChallenge;
    } catch (error) {
      console.error('Error initializing monthly stable challenge:', error);
      return null;
    }
  }

  /**
   * Get current active stable challenge for a stable
   */
  static async getCurrentStableChallenge(stableId: string): Promise<StableChallenge | null> {
    try {
      // For now, use mock data. Later you can fetch from database
      const mockChallenge = await this.initializeMonthlyStableChallenge(stableId, "Your Stable");
      return mockChallenge;
    } catch (error) {
      console.error('Error getting current stable challenge:', error);
      return null;
    }
  }

  /**
   * Update user's contribution to stable challenge
   */
  static async updateUserContribution(
    challengeId: string, 
    userId: string, 
    additionalDistance: number
  ): Promise<boolean> {
    try {
      // This would update the database with the user's new contribution
      // For now, just return success
      console.log(`Updated user ${userId} contribution by ${additionalDistance}km for challenge ${challengeId}`);
      return true;
    } catch (error) {
      console.error('Error updating user contribution:', error);
      return false;
    }
  }

  /**
   * Get user's active stable challenge
   */
  static async getUserActiveStableChallenge(userId: string): Promise<ActiveStableChallenge | null> {
    try {
      // For now, return a mock active stable challenge
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        challengeId: `stable_monthly_user_stable_${now.getFullYear()}_${now.getMonth() + 1}`,
        stableId: 'user_stable',
        startDate: startOfMonth.toISOString(),
        userContribution: 0,
        lastUpdated: now.toISOString(),
        isCompleted: false,
        earnedRewards: []
      };
    } catch (error) {
      console.error('Error getting user active stable challenge:', error);
      return null;
    }
  }

  /**
   * Check if it's time to reset monthly challenges
   */
  static async checkAndResetMonthlyChallenges(): Promise<void> {
    try {
      const now = new Date();
      const isFirstDayOfMonth = now.getDate() === 1;

      if (isFirstDayOfMonth) {
        console.log('First day of month detected - resetting stable challenges');
        // Here you would:
        // 1. Archive completed challenges
        // 2. Create new monthly challenges for all stables
        // 3. Auto-enroll all stable members
        // 4. Send notifications to users about new challenge
      }
    } catch (error) {
      console.error('Error checking/resetting monthly challenges:', error);
    }
  }

  /**
   * Get stable members (mock data for now)
   */
  private static async getStableMembers(stableId: string): Promise<StableParticipant[]> {
    // Mock stable members - replace with real API call
    return [
      {
        userId: 'user1',
        userName: 'Emma Johnson',
        userAvatar: '',
        contribution: 0,
        lastActivityDate: new Date().toISOString(),
        joinDate: new Date().toISOString()
      },
      {
        userId: 'user2',
        userName: 'Mike Wilson',
        userAvatar: '',
        contribution: 0,
        lastActivityDate: new Date().toISOString(),
        joinDate: new Date().toISOString()
      },
      {
        userId: 'user3',
        userName: 'Sarah Davis',
        userAvatar: '',
        contribution: 0,
        lastActivityDate: new Date().toISOString(),
        joinDate: new Date().toISOString()
      }
    ];
  }

  /**
   * Get default rewards for stable challenges
   */
  private static getDefaultStableRewards(): StableChallengeReward[] {
    return [
      {
        id: 'stable_bronze',
        type: 'stable_badge',
        name: 'Stable Team Player',
        description: 'Contributed to your stable\'s monthly goal',
        icon: '🥉',
        threshold: 25, // Individual threshold: 25km contribution
        isStableReward: false
      },
      {
        id: 'stable_silver',
        type: 'stable_badge',
        name: 'Stable Achiever',
        description: 'Made significant contribution to stable goals',
        icon: '🥈',
        threshold: 75, // Individual threshold: 75km contribution
        isStableReward: false
      },
      {
        id: 'stable_gold',
        type: 'stable_badge',
        name: 'Stable Champion',
        description: 'Outstanding contribution to your stable',
        icon: '🥇',
        threshold: 150, // Individual threshold: 150km contribution
        isStableReward: false
      },
      {
        id: 'stable_victory',
        type: 'stable_badge',
        name: 'Stable Victory',
        description: 'Your stable achieved the monthly goal together!',
        icon: '🏆',
        threshold: 500, // Stable threshold: 500km total
        isStableReward: true
      }
    ];
  }

  /**
   * Get mock stable challenge for testing
   */
  static getMockStableChallenge(): StableChallenge {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    return {
      id: `stable_monthly_mock_${now.getFullYear()}_${now.getMonth() + 1}`,
      title: 'Sunset Stables Monthly Challenge',
      description: 'Work together as a stable to reach this month\'s distance goal! Every ride counts towards your stable\'s total.',
      icon: '🏆',
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString(),
      isActive: true,
      stableId: 'sunset_stables',
      stableName: 'Sunset Stables',
      targetDistance: 500,
      unit: 'km',
      participants: ['user1', 'user2', 'user3', 'user4'],
      currentProgress: 187.5,
      leaderboard: [
        {
          userId: 'user1',
          userName: 'Emma Johnson',
          userAvatar: '',
          contribution: 65.2,
          lastActivityDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          joinDate: startOfMonth.toISOString()
        },
        {
          userId: 'user2',
          userName: 'Mike Wilson',
          userAvatar: '',
          contribution: 52.8,
          lastActivityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          joinDate: startOfMonth.toISOString()
        },
        {
          userId: 'user3',
          userName: 'Sarah Davis',
          userAvatar: '',
          contribution: 43.1,
          lastActivityDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          joinDate: startOfMonth.toISOString()
        },
        {
          userId: 'user4',
          userName: 'Alex Thompson',
          userAvatar: '',
          contribution: 26.4,
          lastActivityDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          joinDate: startOfMonth.toISOString()
        }
      ],
      monthlyReset: true,
      rewards: [
        {
          id: 'stable_bronze',
          type: 'stable_badge',
          name: 'Stable Team Player',
          description: 'Contributed to your stable\'s monthly goal',
          icon: '🥉',
          threshold: 25,
          isStableReward: false
        },
        {
          id: 'stable_silver',
          type: 'stable_badge',
          name: 'Stable Achiever',
          description: 'Made significant contribution to stable goals',
          icon: '🥈',
          threshold: 75,
          isStableReward: false
        },
        {
          id: 'stable_gold',
          type: 'stable_badge',
          name: 'Stable Champion',
          description: 'Outstanding contribution to your stable',
          icon: '🥇',
          threshold: 150,
          isStableReward: false
        },
        {
          id: 'stable_victory',
          type: 'stable_badge',
          name: 'Stable Victory',
          description: 'Your stable achieved the monthly goal together!',
          icon: '🏆',
          threshold: 500,
          isStableReward: true
        }
      ]
    };
  }
}
