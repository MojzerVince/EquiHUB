import { ActiveGlobalChallenge, GlobalChallenge, GlobalStableRanking, StableContributor } from '../types/challengeTypes';
import { getSupabase } from './supabase';

export class GlobalChallengeAPI {
  /**
   * Get all active global challenges
   */
  static async getActiveGlobalChallenges(): Promise<GlobalChallenge[]> {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('global_challenges')
        .select(`
          *,
          global_challenge_rewards(*)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching global challenges:', error);
        return [];
      }

      // Get leaderboard for each challenge
      const challenges: GlobalChallenge[] = await Promise.all(
        (data || []).map(async (challenge: any) => {
          const leaderboard = await this.getGlobalLeaderboard(challenge.id);
          
          return {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            icon: challenge.icon,
            startDate: challenge.start_date,
            endDate: challenge.end_date,
            isActive: challenge.is_active,
            targetDistance: parseFloat(challenge.target_distance),
            unit: challenge.unit,
            challengeType: challenge.challenge_type,
            difficulty: challenge.difficulty,
            maxParticipants: challenge.max_participants,
            globalLeaderboard: leaderboard,
            totalParticipatingStables: leaderboard.length,
            rewards: challenge.global_challenge_rewards?.map((reward: any) => ({
              id: reward.id,
              type: reward.type,
              name: reward.name,
              description: reward.description,
              icon: reward.icon,
              threshold: parseFloat(reward.threshold),
              rankRequirement: reward.rank_requirement,
              isStableReward: reward.is_stable_reward
            })) || []
          };
        })
      );

      return challenges;
    } catch (error) {
      console.error('Exception fetching global challenges:', error);
      return [];
    }
  }

  /**
   * Get current monthly global challenge
   */
  static async getCurrentMonthlyChallenge(): Promise<GlobalChallenge | null> {
    const challenges = await this.getActiveGlobalChallenges();
    return challenges.find(c => c.challengeType === 'monthly') || null;
  }

  /**
   * Get global leaderboard for a specific challenge
   */
  static async getGlobalLeaderboard(challengeId: string, userId?: string): Promise<GlobalStableRanking[]> {
    try {
      const supabase = getSupabase();

      // Get user's stable ID if provided
      let userStableId: string | null = null;
      if (userId) {
        const { data: userStable } = await supabase
          .from('stable_members')
          .select('stable_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();
        
        userStableId = userStable?.stable_id || null;
      }

      // Query individual stable contributions and aggregate them to get stable totals
      const { data: contributions, error } = await supabase
        .from('individual_stable_contributions')
        .select(`
          stable_id,
          contribution,
          stables(name)
        `)
        .eq('challenge_id', challengeId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching global leaderboard:', error);
        return [];
      }

      // Aggregate contributions by stable
      const stableMap = new Map();
      
      contributions?.forEach((contrib: any) => {
        const stableId = contrib.stable_id;
        const stableName = contrib.stables?.name || 'Unknown Stable';
        const contribution = parseFloat(contrib.contribution) || 0;
        
        if (stableMap.has(stableId)) {
          const existing = stableMap.get(stableId);
          existing.totalProgress += contribution;
          existing.memberCount += 1;
        } else {
          stableMap.set(stableId, {
            stableId,
            stableName,
            totalProgress: contribution,
            memberCount: 1
          });
        }
      });

      // Convert to array and sort by total progress
      const rankings = Array.from(stableMap.values())
        .sort((a, b) => b.totalProgress - a.totalProgress)
        .map((stable, index) => ({
          rank: index + 1,
          stableId: stable.stableId,
          stableName: stable.stableName,
          progressValue: stable.totalProgress,
          memberCount: stable.memberCount,
          averageContribution: stable.memberCount > 0 ? stable.totalProgress / stable.memberCount : 0,
          completedAt: undefined, // Changed from null to undefined
          lastUpdated: new Date().toISOString(),
          isUserStable: userStableId === stable.stableId
        }));

      return rankings;
    } catch (error) {
      console.error('Exception fetching global leaderboard:', error);
      return [];
    }
  }

  /**
   * Get stable contributors for a specific challenge and stable
   */
  static async getStableContributors(challengeId: string, stableId: string): Promise<StableContributor[]> {
    try {
      const supabase = getSupabase();

      const { data: contributors, error } = await supabase
        .from('individual_stable_contributions')
        .select(`
          user_id,
          contribution,
          session_count,
          last_activity_date,
          join_date,
          profiles(name, profile_image_url)
        `)
        .eq('challenge_id', challengeId)
        .eq('stable_id', stableId)
        .eq('is_active', true)
        .order('contribution', { ascending: false });

      if (error) {
        console.error('Error fetching stable contributors:', error);
        return [];
      }

      return (contributors || []).map((contributor: any) => ({
        userId: contributor.user_id,
        userName: contributor.profiles?.name || 'Unknown User',
        userAvatar: contributor.profiles?.profile_image_url || '',
        contribution: parseFloat(contributor.contribution),
        sessionCount: contributor.session_count,
        lastActivityDate: contributor.last_activity_date,
        joinDate: contributor.join_date
      }));
    } catch (error) {
      console.error('Exception fetching stable contributors:', error);
      return [];
    }
  }

  /**
   * Add distance to user's contribution in global challenge
   */
  static async addDistanceToGlobalChallenge(
    userId: string, 
    distance: number, 
    sessionCount: number = 1
  ): Promise<boolean> {
    try {
      const supabase = getSupabase();

      // Get user's stable
      const { data: userStable } = await supabase
        .from('stable_members')
        .select('stable_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!userStable) {
        console.log('User is not in an active stable');
        return false;
      }

      // Get current active global challenge
      const activeChallenge = await this.getCurrentMonthlyChallenge();
      if (!activeChallenge) {
        console.log('No active global challenge found');
        return false;
      }

      // Get current contribution
      const { data: currentContribution } = await supabase
        .from('individual_stable_contributions')
        .select('contribution, session_count')
        .eq('challenge_id', activeChallenge.id)
        .eq('stable_id', userStable.stable_id)
        .eq('user_id', userId)
        .single();

      const newContribution = (currentContribution?.contribution ? parseFloat(currentContribution.contribution) : 0) + distance;
      const newSessionCount = (currentContribution?.session_count || 0) + sessionCount;

      // Upsert user's contribution
      const { error } = await supabase
        .from('individual_stable_contributions')
        .upsert({
          challenge_id: activeChallenge.id,
          stable_id: userStable.stable_id,
          user_id: userId,
          contribution: newContribution,
          session_count: newSessionCount,
          last_activity_date: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'challenge_id,stable_id,user_id'
        });

      if (error) {
        console.error('Error adding distance to global challenge:', error);
        return false;
      }

      // The trigger will automatically update stable progress and rankings
      return true;
    } catch (error) {
      console.error('Exception adding distance to global challenge:', error);
      return false;
    }
  }

  /**
   * Get user's active global challenge
   */
  static async getUserActiveGlobalChallenge(userId: string): Promise<ActiveGlobalChallenge | null> {
    try {
      const supabase = getSupabase();

      // Get user's stable
      const { data: userStable } = await supabase
        .from('stable_members')
        .select('stable_id, stables(name)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!userStable) {
        return null; // User is not in a stable
      }

      // Get current active challenge
      const activeChallenge = await this.getCurrentMonthlyChallenge();
      if (!activeChallenge) {
        return null; // No active challenge
      }

      // Get user's contribution
      const { data: userContribution } = await supabase
        .from('individual_stable_contributions')
        .select('contribution')
        .eq('challenge_id', activeChallenge.id)
        .eq('stable_id', userStable.stable_id)
        .eq('user_id', userId)
        .single();

      // Get all contributions for this stable to calculate total progress
      const { data: allStableContributions } = await supabase
        .from('individual_stable_contributions')
        .select('contribution')
        .eq('challenge_id', activeChallenge.id)
        .eq('stable_id', userStable.stable_id)
        .eq('is_active', true);

      // Calculate stable's total progress
      const stableProgressValue = allStableContributions?.reduce((total: number, contrib: any) => 
        total + (parseFloat(contrib.contribution) || 0), 0
      ) || 0;

      // Get rank by comparing with other stables (this is a simplified approach)
      // For better performance, you might want to implement this differently
      const { data: allStableRankings } = await supabase
        .from('individual_stable_contributions')
        .select('stable_id, contribution')
        .eq('challenge_id', activeChallenge.id)
        .eq('is_active', true);

      // Calculate each stable's total and determine rank
      const stableTotals = new Map();
      allStableRankings?.forEach((contrib: any) => {
        const stableId = contrib.stable_id;
        const contribution = parseFloat(contrib.contribution) || 0;
        stableTotals.set(stableId, (stableTotals.get(stableId) || 0) + contribution);
      });

      const sortedStables = Array.from(stableTotals.entries())
        .sort((a, b) => b[1] - a[1]);
      
      // Fix rank calculation - ensure we get a valid rank
      let userStableRank = sortedStables.findIndex(([stableId]) => stableId === userStable.stable_id) + 1;
      
      // If rank is 0 (not found), it means the stable might not have contributions yet
      // In that case, if there are no contributions, rank should be 1 (only participant)
      // If there are other stables with contributions, rank should be last
      if (userStableRank === 0) {
        if (sortedStables.length === 0) {
          userStableRank = 1; // Only participant, should be #1
        } else {
          userStableRank = sortedStables.length + 1; // Last place after all contributing stables
        }
      }

      // Get user's earned rewards
      const { data: rewards } = await supabase
        .from('user_global_challenge_rewards')
        .select('reward_id')
        .eq('challenge_id', activeChallenge.id)
        .eq('user_id', userId);

      const activeGlobalChallenge: ActiveGlobalChallenge = {
        challengeId: activeChallenge.id,
        stableId: userStable.stable_id,
        stableName: (userStable.stables as any)?.name || 'Your Stable',
        startDate: activeChallenge.startDate,
        userContribution: userContribution ? parseFloat(userContribution.contribution) : 0,
        stableProgress: stableProgressValue,
        stableRank: userStableRank,
        lastUpdated: new Date().toISOString(),
        isCompleted: stableProgressValue >= activeChallenge.targetDistance, // Check if target reached
        completedDate: stableProgressValue >= activeChallenge.targetDistance ? new Date().toISOString() : undefined,
        earnedRewards: rewards?.map((r: any) => r.reward_id) || []
      };

      return activeGlobalChallenge;
    } catch (error) {
      console.error('Exception getting user active global challenge:', error);
      return null;
    }
  }

  /**
   * Create a new global challenge (admin function)
   */
  static async createGlobalChallenge(challengeData: {
    title: string;
    description: string;
    icon: string;
    startDate: string;
    endDate: string;
    targetDistance: number;
    unit: 'km' | 'mi';
    challengeType: 'weekly' | 'monthly' | 'special';
    difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
    maxParticipants?: number;
  }): Promise<string | null> {
    try {
      const supabase = getSupabase();

      const challengeId = `global_${challengeData.challengeType}_${Date.now()}`;

      const { error } = await supabase
        .from('global_challenges')
        .insert({
          id: challengeId,
          title: challengeData.title,
          description: challengeData.description,
          icon: challengeData.icon,
          start_date: challengeData.startDate,
          end_date: challengeData.endDate,
          is_active: true,
          target_distance: challengeData.targetDistance,
          unit: challengeData.unit,
          challenge_type: challengeData.challengeType,
          difficulty: challengeData.difficulty,
          max_participants: challengeData.maxParticipants
        });

      if (error) {
        console.error('Error creating global challenge:', error);
        return null;
      }

      // Auto-enroll all stables
      await this.autoEnrollAllStables(challengeId);

      return challengeId;
    } catch (error) {
      console.error('Exception creating global challenge:', error);
      return null;
    }
  }

  /**
   * Auto-enroll all active stables in a global challenge
   */
  static async autoEnrollAllStables(challengeId: string): Promise<void> {
    try {
      const supabase = getSupabase();

      // Call the database function to auto-enroll stables
      const { error } = await supabase.rpc('auto_enroll_stables_in_global_challenge', {
        challenge_uuid: challengeId
      });

      if (error) {
        console.error('Error auto-enrolling stables:', error);
      }
    } catch (error) {
      console.error('Exception auto-enrolling stables:', error);
    }
  }

  /**
   * Get challenge statistics for a specific challenge
   */
  static async getChallengeStatistics(challengeId: string): Promise<{
    totalStables: number;
    totalDistance: number;
    averageDistance: number;
    completedStables: number;
    totalContributors: number;
  }> {
    try {
      const supabase = getSupabase();

      // Get stable statistics by aggregating individual contributions
      const { data: allContributions } = await supabase
        .from('individual_stable_contributions')
        .select('stable_id, contribution, is_active')
        .eq('challenge_id', challengeId)
        .eq('is_active', true);

      // Calculate stable totals
      const stableMap = new Map();
      allContributions?.forEach((contrib: any) => {
        const stableId = contrib.stable_id;
        const contribution = parseFloat(contrib.contribution) || 0;
        
        if (stableMap.has(stableId)) {
          stableMap.get(stableId).totalProgress += contribution;
        } else {
          stableMap.set(stableId, {
            stableId,
            totalProgress: contribution,
            memberCount: 1
          });
        }
      });

      const stableStats = Array.from(stableMap.values());

      // Get current challenge to check target distance
      const { data: currentChallenge } = await supabase
        .from('global_challenges')
        .select('target_distance')
        .eq('id', challengeId)
        .single();

      const targetDistance = currentChallenge?.target_distance || 500;

      // Get contributor count
      const { count: contributorCount } = await supabase
        .from('individual_stable_contributions')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId)
        .eq('is_active', true);

      const totalStables = stableStats?.length || 0;
      const totalDistance = stableStats?.reduce((sum: number, stable: any) => sum + stable.totalProgress, 0) || 0;
      const averageDistance = totalStables > 0 ? totalDistance / totalStables : 0;
      const completedStables = stableStats?.filter((stable: any) => stable.totalProgress >= targetDistance).length || 0;
      const totalContributors = contributorCount || 0;

      return {
        totalStables,
        totalDistance,
        averageDistance,
        completedStables,
        totalContributors
      };
    } catch (error) {
      console.error('Exception getting challenge statistics:', error);
      return {
        totalStables: 0,
        totalDistance: 0,
        averageDistance: 0,
        completedStables: 0,
        totalContributors: 0
      };
    }
  }

  /**
   * Check if user can participate in global challenges
   */
  static async canUserParticipate(userId: string): Promise<boolean> {
    try {
      const supabase = getSupabase();

      // Check if user is in an active stable
      const { data: userStable } = await supabase
        .from('stable_members')
        .select('stable_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      return !!userStable;
    } catch (error) {
      console.error('Exception checking user participation eligibility:', error);
      return false;
    }
  }

  /**
   * Get top performers across all stables for a challenge
   */
  static async getTopPerformers(challengeId: string, limit: number = 10): Promise<{
    userId: string;
    userName: string;
    userAvatar?: string;
    stableId: string;
    stableName: string;
    contribution: number;
  }[]> {
    try {
      const supabase = getSupabase();

      const { data: topPerformers, error } = await supabase
        .from('individual_stable_contributions')
        .select(`
          user_id,
          stable_id,
          contribution,
          profiles(name, profile_image_url),
          stables(name)
        `)
        .eq('challenge_id', challengeId)
        .eq('is_active', true)
        .order('contribution', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching top performers:', error);
        return [];
      }

      return (topPerformers || []).map((performer: any) => ({
        userId: performer.user_id,
        userName: performer.profiles?.name || 'Unknown User',
        userAvatar: performer.profiles?.profile_image_url || '',
        stableId: performer.stable_id,
        stableName: performer.stables?.name || 'Unknown Stable',
        contribution: parseFloat(performer.contribution)
      }));
    } catch (error) {
      console.error('Exception fetching top performers:', error);
      return [];
    }
  }
}
