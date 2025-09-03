// Challenge types and interfaces
export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'weekly' | 'monthly' | 'special';
  icon: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  goals: ChallengeGoal[];
  rewards: ChallengeReward[];
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  category: 'distance' | 'time' | 'sessions' | 'endurance';
}

export interface ChallengeGoal {
  id: string;
  target: number;
  unit: 'km' | 'mi' | 'hours' | 'sessions' | 'minutes';
  label: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  badge?: string;
}

export interface ChallengeReward {
  id: string;
  type: 'badge' | 'points' | 'title';
  name: string;
  description: string;
  icon: string;
  goalId: string; // Which goal this reward is for
}

export interface ActiveChallenge {
  challengeId: string;
  goalId: string;
  startDate: string;
  progress: number;
  target: number;
  unit: string;
  lastUpdated: string;
  sessions: ChallengeSession[];
  isCompleted: boolean;
  completedDate?: string;
  earnedRewards: string[]; // Array of reward IDs
}

export interface ChallengeSession {
  id: string;
  date: string;
  distance: number;
  duration: number; // in minutes
  horseName?: string;
  notes?: string;
}

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate: string;
  challengeId: string;
  goalId: string;
}
