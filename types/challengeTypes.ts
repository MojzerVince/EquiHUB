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

export interface GlobalChallengeReward {
  id: string;
  type: 'stable_badge' | 'individual_badge' | 'points' | 'title' | 'leaderboard_position';
  name: string;
  description: string;
  icon: string;
  threshold: number; // Distance threshold to earn this reward
  rankRequirement?: number; // For position-based rewards (1st, 2nd, 3rd place, etc.)
  isStableReward: boolean; // true if reward is for entire stable, false for individual
}

export interface ActiveGlobalChallenge {
  challengeId: string;
  stableId: string;
  stableName: string;
  startDate: string;
  userContribution: number; // User's individual contribution
  stableProgress: number; // Stable's total progress
  stableRank: number; // Current rank in global leaderboard
  lastUpdated: string;
  isCompleted: boolean;
  completedDate?: string;
  earnedRewards: string[]; // Array of reward IDs earned by user
}

// Global Stable Challenge interfaces
export interface GlobalChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  targetDistance: number; // Distance goal for each stable to achieve
  unit: 'km' | 'mi';
  challengeType: 'weekly' | 'monthly' | 'special';
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  maxParticipants?: number; // Maximum number of stables that can participate
  globalLeaderboard: GlobalStableRanking[];
  rewards: GlobalChallengeReward[];
  totalParticipatingStables: number;
}

export interface GlobalStableRanking {
  rank: number;
  stableId: string;
  stableName: string;
  progressValue: number; // Total distance achieved by stable
  memberCount: number; // Number of active contributing members
  averageContribution: number; // Average distance per member
  completedAt?: string; // When they reached the target (if they did)
  lastUpdated: string;
  isUserStable: boolean; // True if this is the current user's stable
}

export interface StableContributor {
  userId: string;
  userName: string;
  userAvatar?: string;
  contribution: number; // Individual distance contributed
  sessionCount: number; // Number of sessions contributed
  lastActivityDate: string;
  joinDate: string;
}

// Legacy StableChallenge interface (keeping for backward compatibility)
export interface StableChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  startDate: string; // Start of the month
  endDate: string; // End of the month
  isActive: boolean;
  stableId: string;
  stableName: string;
  targetDistance: number; // Total distance goal for the stable
  unit: 'km' | 'mi';
  participants: string[]; // Array of user IDs
  currentProgress: number; // Current total distance achieved
  leaderboard: StableParticipant[];
  rewards: StableChallengeReward[];
  monthlyReset: boolean; // Always true for automatic monthly reset
}

export interface StableParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  contribution: number; // Individual distance contributed
  lastActivityDate: string;
  joinDate: string;
}

export interface StableChallengeReward {
  id: string;
  type: 'stable_badge' | 'individual_badge' | 'points' | 'title';
  name: string;
  description: string;
  icon: string;
  threshold: number; // Distance threshold to earn this reward
  isStableReward: boolean; // true if reward is for entire stable, false for individual
}

export interface ActiveStableChallenge {
  challengeId: string;
  stableId: string;
  startDate: string;
  userContribution: number; // User's individual contribution
  lastUpdated: string;
  isCompleted: boolean;
  completedDate?: string;
  earnedRewards: string[]; // Array of reward IDs earned by user
}
