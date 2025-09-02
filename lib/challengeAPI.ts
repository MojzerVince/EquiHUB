import { Challenge } from '../types/challengeTypes';
import { getSupabase } from './supabase';

export class ChallengeAPI {
  /**
   * Get all active challenges from Supabase
   */
  static async getActiveChallenges(): Promise<Challenge[]> {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_goals(*),
          challenge_rewards(*)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching challenges:', error);
        return [];
      }

      // Transform the data to match our interface
      const challenges: Challenge[] = data?.map((challenge: any) => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        icon: challenge.icon,
        startDate: challenge.start_date,
        endDate: challenge.end_date,
        isActive: challenge.is_active,
        difficulty: challenge.difficulty,
        category: challenge.category,
        goals: challenge.challenge_goals?.map((goal: any) => ({
          id: goal.id,
          target: goal.target,
          unit: goal.unit,
          label: goal.label,
          difficulty: goal.difficulty,
          badge: goal.badge
        })) || [],
        rewards: challenge.challenge_rewards?.map((reward: any) => ({
          id: reward.id,
          type: reward.type,
          name: reward.name,
          description: reward.description,
          icon: reward.icon,
          goalId: reward.goal_id
        })) || []
      })) || [];

      return challenges;
    } catch (error) {
      console.error('Exception fetching challenges:', error);
      return [];
    }
  }

  /**
   * Get weekly challenges
   */
  static async getWeeklyChallenges(): Promise<Challenge[]> {
    const allChallenges = await this.getActiveChallenges();
    return allChallenges.filter(challenge => challenge.type === 'weekly');
  }

  /**
   * Get monthly challenges
   */
  static async getMonthlyChallenges(): Promise<Challenge[]> {
    const allChallenges = await this.getActiveChallenges();
    return allChallenges.filter(challenge => challenge.type === 'monthly');
  }

  /**
   * Get special/limited time challenges
   */
  static async getSpecialChallenges(): Promise<Challenge[]> {
    const allChallenges = await this.getActiveChallenges();
    return allChallenges.filter(challenge => challenge.type === 'special');
  }

  /**
   * Get challenge by ID
   */
  static async getChallengeById(challengeId: string): Promise<Challenge | null> {
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_goals(*),
          challenge_rewards(*)
        `)
        .eq('id', challengeId)
        .single();

      if (error || !data) {
        console.error('Error fetching challenge:', error);
        return null;
      }

      const challenge: Challenge = {
        id: data.id,
        title: data.title,
        description: data.description,
        type: data.type,
        icon: data.icon,
        startDate: data.start_date,
        endDate: data.end_date,
        isActive: data.is_active,
        difficulty: data.difficulty,
        category: data.category,
        goals: data.challenge_goals?.map((goal: any) => ({
          id: goal.id,
          target: goal.target,
          unit: goal.unit,
          label: goal.label,
          difficulty: goal.difficulty,
          badge: goal.badge
        })) || [],
        rewards: data.challenge_rewards?.map((reward: any) => ({
          id: reward.id,
          type: reward.type,
          name: reward.name,
          description: reward.description,
          icon: reward.icon,
          goalId: reward.goal_id
        })) || []
      };

      return challenge;
    } catch (error) {
      console.error('Exception fetching challenge by ID:', error);
      return null;
    }
  }

  /**
   * Create mock data for testing (you can remove this later)
   */
  static getMockChallenges(): Challenge[] {
    return [
      {
        id: 'weekly_distance_1',
        title: 'Weekly Distance Challenge',
        description: 'Complete your weekly distance goal and earn amazing badges!',
        type: 'weekly',
        icon: '🏇',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        difficulty: 'medium',
        category: 'distance',
        goals: [
          {
            id: 'goal_20km',
            target: 20,
            unit: 'km',
            label: '20 km Explorer',
            difficulty: 'easy',
            badge: '🥉'
          },
          {
            id: 'goal_50km',
            target: 50,
            unit: 'km',
            label: '50 km Adventurer',
            difficulty: 'medium',
            badge: '🥈'
          },
          {
            id: 'goal_75km',
            target: 75,
            unit: 'km',
            label: '75 km Champion',
            difficulty: 'hard',
            badge: '🥇'
          },
          {
            id: 'goal_100km',
            target: 100,
            unit: 'km',
            label: '100 km Legend',
            difficulty: 'extreme',
            badge: '🏆'
          }
        ],
        rewards: [
          {
            id: 'reward_20km',
            type: 'badge',
            name: 'Distance Explorer',
            description: 'Completed 20km in one week',
            icon: '🥉',
            goalId: 'goal_20km'
          },
          {
            id: 'reward_50km',
            type: 'badge',
            name: 'Distance Adventurer',
            description: 'Completed 50km in one week',
            icon: '🥈',
            goalId: 'goal_50km'
          },
          {
            id: 'reward_75km',
            type: 'badge',
            name: 'Distance Champion',
            description: 'Completed 75km in one week',
            icon: '🥇',
            goalId: 'goal_75km'
          },
          {
            id: 'reward_100km',
            type: 'badge',
            name: 'Distance Legend',
            description: 'Completed 100km in one week - True dedication!',
            icon: '🏆',
            goalId: 'goal_100km'
          }
        ]
      },
      {
        id: 'monthly_endurance_1',
        title: 'Monthly Endurance Challenge',
        description: 'Test your endurance over a full month!',
        type: 'monthly',
        icon: '⚡',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        difficulty: 'hard',
        category: 'endurance',
        goals: [
          {
            id: 'goal_40h',
            target: 40,
            unit: 'hours',
            label: '40 Hours Dedication',
            difficulty: 'medium',
            badge: '⏰'
          },
          {
            id: 'goal_80h',
            target: 80,
            unit: 'hours',
            label: '80 Hours Commitment',
            difficulty: 'hard',
            badge: '🕐'
          },
          {
            id: 'goal_120h',
            target: 120,
            unit: 'hours',
            label: '120 Hours Mastery',
            difficulty: 'extreme',
            badge: '⌚'
          }
        ],
        rewards: [
          {
            id: 'reward_40h',
            type: 'badge',
            name: 'Endurance Starter',
            description: 'Completed 40 hours of training',
            icon: '⏰',
            goalId: 'goal_40h'
          },
          {
            id: 'reward_80h',
            type: 'badge',
            name: 'Endurance Master',
            description: 'Completed 80 hours of training',
            icon: '🕐',
            goalId: 'goal_80h'
          },
          {
            id: 'reward_120h',
            type: 'badge',
            name: 'Endurance Legend',
            description: 'Completed 120 hours of training - Incredible!',
            icon: '⌚',
            goalId: 'goal_120h'
          }
        ]
      }
    ];
  }
}
