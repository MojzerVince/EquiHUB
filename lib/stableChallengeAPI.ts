import { ActiveStableChallenge, StableChallenge, StableParticipant } from '../types/challengeTypes';
import { getSupabase } from './supabase';

export class StableChallengeAPI {
  /**
   * Initialize automatic stable challenge for a stable
   * This creates a new monthly challenge that auto-enrolls all stable members
   */
  static async initializeMonthlyStableChallenge(stableId: string, stableName: string): Promise<StableChallenge | null> {
    try {
      const supabase = getSupabase();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const challengeId = `stable_monthly_${stableId}_${now.getFullYear()}_${now.getMonth() + 1}`;

      // Check if challenge already exists for this month
      const { data: existingChallenge } = await supabase
        .from('stable_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (existingChallenge) {
        // Return existing challenge with current data
        return await this.getCurrentStableChallenge(stableId);
      }

      // Create new challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('stable_challenges')
        .insert({
          id: challengeId,
          stable_id: stableId,
          title: `${stableName} Monthly Challenge`,
          description: `Work together as a stable to reach this month's distance goal! Every ride counts towards your stable's total.`,
          icon: '🏆',
          start_date: startOfMonth.toISOString(),
          end_date: endOfMonth.toISOString(),
          is_active: true,
          target_distance: 500, // Default 500km/month for stable
          unit: 'km',
          current_progress: 0,
          monthly_reset: true
        })
        .select()
        .single();

      if (challengeError) {
        console.error('Error creating stable challenge:', challengeError);
        return null;
      }

      // Create default rewards
      const rewards = this.getDefaultStableRewards();
      const rewardsWithChallengeId = rewards.map(reward => ({
        ...reward,
        challenge_id: challengeId
      }));

      const { error: rewardsError } = await supabase
        .from('stable_challenge_rewards')
        .insert(rewardsWithChallengeId);

      if (rewardsError) {
        console.error('Error creating stable challenge rewards:', rewardsError);
      }

      // Auto-enroll all stable members
      await this.enrollStableMembers(challengeId, stableId);

      // Return the newly created challenge
      return await this.getCurrentStableChallenge(stableId);
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
      const supabase = getSupabase();
      const now = new Date().toISOString();

      // Get active challenge for this stable
      const { data: challenge, error: challengeError } = await supabase
        .from('stable_challenges')
        .select(`
          *,
          stable_challenge_rewards(*)
        `)
        .eq('stable_id', stableId)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      if (challengeError || !challenge) {
        console.log('No active stable challenge found, creating new one');
        // Get stable name first
        const { data: stable } = await supabase
          .from('stables')
          .select('name')
          .eq('id', stableId)
          .single();
        
        const stableName = stable?.name || 'Your Stable';
        return await this.initializeMonthlyStableChallenge(stableId, stableName);
      }

      // Get participants with leaderboard data
      const { data: participants, error: participantsError } = await supabase
        .from('stable_challenge_participants')
        .select(`
          *,
          profiles(name, profile_image_url)
        `)
        .eq('challenge_id', challenge.id)
        .eq('is_active', true)
        .order('contribution', { ascending: false });

      if (participantsError) {
        console.error('Error loading participants:', participantsError);
      }

      // Get stable name
      const { data: stable } = await supabase
        .from('stables')
        .select('name')
        .eq('id', stableId)
        .single();

      // Transform to StableChallenge format
      const stableChallenge: StableChallenge = {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        icon: challenge.icon,
        startDate: challenge.start_date,
        endDate: challenge.end_date,
        isActive: challenge.is_active,
        stableId: challenge.stable_id,
        stableName: stable?.name || 'Your Stable',
        targetDistance: parseFloat(challenge.target_distance),
        unit: challenge.unit,
        participants: participants?.map((p: any) => p.user_id) || [],
        currentProgress: parseFloat(challenge.current_progress),
        leaderboard: participants?.map((p: any) => ({
          userId: p.user_id,
          userName: p.profiles?.name || 'Unknown User',
          userAvatar: p.profiles?.profile_image_url || '',
          contribution: parseFloat(p.contribution),
          lastActivityDate: p.last_activity_date,
          joinDate: p.join_date
        })) || [],
        monthlyReset: challenge.monthly_reset,
        rewards: challenge.stable_challenge_rewards?.map((r: any) => ({
          id: r.id,
          type: r.type,
          name: r.name,
          description: r.description,
          icon: r.icon,
          threshold: parseFloat(r.threshold),
          isStableReward: r.is_stable_reward
        })) || []
      };

      return stableChallenge;
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
      const supabase = getSupabase();

      // Upsert user's contribution
      const { error } = await supabase
        .from('stable_challenge_participants')
        .upsert({
          challenge_id: challengeId,
          user_id: userId,
          contribution: additionalDistance,
          last_activity_date: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'challenge_id,user_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error updating user contribution:', error);
        return false;
      }

      // The trigger will automatically update the stable challenge progress
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
      const supabase = getSupabase();

      // First get user's stable
      const { data: userStable } = await supabase
        .from('stable_members')
        .select('stable_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!userStable) {
        return null; // User is not in a stable
      }

      // Get current active challenge for their stable
      const now = new Date().toISOString();
      const { data: challenge } = await supabase
        .from('stable_challenges')
        .select('*')
        .eq('stable_id', userStable.stable_id)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .single();

      if (!challenge) {
        return null; // No active challenge
      }

      // Get user's participation data
      const { data: participation } = await supabase
        .from('stable_challenge_participants')
        .select('contribution')
        .eq('challenge_id', challenge.id)
        .eq('user_id', userId)
        .single();

      // Get user's earned rewards
      const { data: rewards } = await supabase
        .from('user_stable_challenge_rewards')
        .select('reward_id')
        .eq('challenge_id', challenge.id)
        .eq('user_id', userId);

      const activeStableChallenge: ActiveStableChallenge = {
        challengeId: challenge.id,
        stableId: challenge.stable_id,
        startDate: challenge.start_date,
        userContribution: participation ? parseFloat(participation.contribution) : 0,
        lastUpdated: new Date().toISOString(),
        isCompleted: parseFloat(challenge.current_progress) >= parseFloat(challenge.target_distance),
        earnedRewards: rewards?.map((r: any) => r.reward_id) || []
      };

      return activeStableChallenge;
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
      const supabase = getSupabase();
      const now = new Date();
      const isFirstDayOfMonth = now.getDate() === 1;

      if (isFirstDayOfMonth) {
        console.log('First day of month detected - creating new stable challenges');
        
        // Get all active stables
        const { data: stables } = await supabase
          .from('stables')
          .select('id, name')
          .order('name');

        if (stables) {
          // Create new challenges for all stables
          for (const stable of stables) {
            await this.initializeMonthlyStableChallenge(stable.id, stable.name);
          }
        }
      }
    } catch (error) {
      console.error('Error checking/resetting monthly challenges:', error);
    }
  }

  /**
   * Enroll all stable members in a challenge
   */
  private static async enrollStableMembers(challengeId: string, stableId: string): Promise<void> {
    try {
      const supabase = getSupabase();

      // Get all active stable members
      const { data: members } = await supabase
        .from('stable_members')
        .select('user_id')
        .eq('stable_id', stableId)
        .eq('is_active', true);

      if (members && members.length > 0) {
        // Create participant records for all members
        const participants = members.map((member: any) => ({
          challenge_id: challengeId,
          user_id: member.user_id,
          contribution: 0,
          last_activity_date: new Date().toISOString(),
          join_date: new Date().toISOString(),
          is_active: true
        }));

        const { error } = await supabase
          .from('stable_challenge_participants')
          .insert(participants);

        if (error) {
          console.error('Error enrolling stable members:', error);
        }
      }
    } catch (error) {
      console.error('Error enrolling stable members:', error);
    }
  }

  /**
   * Get stable members from database
   */
  static async getStableMembers(stableId: string): Promise<StableParticipant[]> {
    try {
      const supabase = getSupabase();

      const { data: members, error } = await supabase
        .from('stable_members')
        .select(`
          user_id,
          profiles(name, profile_image_url)
        `)
        .eq('stable_id', stableId)
        .eq('is_active', true);

      if (error) {
        console.error('Error getting stable members:', error);
        return [];
      }

      return members?.map((member: any) => ({
        userId: member.user_id,
        userName: member.profiles?.name || 'Unknown User',
        userAvatar: member.profiles?.profile_image_url || '',
        contribution: 0,
        lastActivityDate: new Date().toISOString(),
        joinDate: new Date().toISOString()
      })) || [];
    } catch (error) {
      console.error('Error getting stable members:', error);
      return [];
    }
  }

  /**
   * Get default rewards for stable challenges
   */
  private static getDefaultStableRewards(): any[] {
    return [
      {
        id: 'stable_bronze',
        type: 'stable_badge',
        name: 'Stable Team Player',
        description: 'Contributed to your stable\'s monthly goal',
        icon: '🥉',
        threshold: 25, // Individual threshold: 25km contribution
        is_stable_reward: false
      },
      {
        id: 'stable_silver',
        type: 'stable_badge',
        name: 'Stable Achiever',
        description: 'Made significant contribution to stable goals',
        icon: '🥈',
        threshold: 75, // Individual threshold: 75km contribution
        is_stable_reward: false
      },
      {
        id: 'stable_gold',
        type: 'stable_badge',
        name: 'Stable Champion',
        description: 'Outstanding contribution to your stable',
        icon: '🥇',
        threshold: 150, // Individual threshold: 150km contribution
        is_stable_reward: false
      },
      {
        id: 'stable_victory',
        type: 'stable_badge',
        name: 'Stable Victory',
        description: 'Your stable achieved the monthly goal together!',
        icon: '🏆',
        threshold: 500, // Stable threshold: 500km total
        is_stable_reward: true
      }
    ];
  }

  /**
   * Get real-time leaderboard for a stable challenge
   */
  static async getStableChallengeLeaderboard(challengeId: string): Promise<StableParticipant[]> {
    try {
      const supabase = getSupabase();

      const { data: participants, error } = await supabase
        .from('stable_challenge_participants')
        .select(`
          user_id,
          contribution,
          last_activity_date,
          join_date,
          profiles(name, profile_image_url)
        `)
        .eq('challenge_id', challengeId)
        .eq('is_active', true)
        .order('contribution', { ascending: false });

      if (error) {
        console.error('Error getting leaderboard:', error);
        return [];
      }

      return participants?.map((p: any) => ({
        userId: p.user_id,
        userName: p.profiles?.name || 'Unknown User',
        userAvatar: p.profiles?.profile_image_url || '',
        contribution: parseFloat(p.contribution),
        lastActivityDate: p.last_activity_date,
        joinDate: p.join_date
      })) || [];
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Add distance to user's stable challenge contribution
   */
  static async addDistanceToStableChallenge(userId: string, distance: number): Promise<boolean> {
    try {
      const supabase = getSupabase();

      // Get user's current active stable challenge
      const activeChallenge = await this.getUserActiveStableChallenge(userId);
      if (!activeChallenge) {
        return false; // User not in active stable challenge
      }

      // Get current contribution
      const { data: currentParticipation } = await supabase
        .from('stable_challenge_participants')
        .select('contribution')
        .eq('challenge_id', activeChallenge.challengeId)
        .eq('user_id', userId)
        .single();

      const currentContribution = currentParticipation ? parseFloat(currentParticipation.contribution) : 0;
      const newContribution = currentContribution + distance;

      // Update contribution
      const { error } = await supabase
        .from('stable_challenge_participants')
        .upsert({
          challenge_id: activeChallenge.challengeId,
          user_id: userId,
          contribution: newContribution,
          last_activity_date: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'challenge_id,user_id'
        });

      if (error) {
        console.error('Error adding distance to stable challenge:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding distance to stable challenge:', error);
      return false;
    }
  }
}
