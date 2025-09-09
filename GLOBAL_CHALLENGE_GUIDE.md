# Global Stable Challenge System

This document explains how the new global stable challenge system works, where all stables compete against each other based on their collective progress.

## Overview

The global stable challenge system transforms individual stable challenges into a competitive global arena where:

- **All stables compete together** in the same challenges
- **Rankings are determined** by total stable progress and average member contribution
- **Individual contributions** count toward their stable's total progress
- **Leaderboards show** real-time rankings across all participating stables
- **Rewards are earned** both individually and by stable placement

## Key Features

### 1. Global Competition

- All active stables automatically participate in monthly global challenges
- Real-time leaderboard showing stable rankings
- Progress tracked both individually and at stable level

### 2. Multi-Level Scoring

- **Total Progress**: Sum of all stable member contributions
- **Average Contribution**: Average distance per active member
- **Member Count**: Number of contributing members
- **Ranking Algorithm**: Considers both total progress and efficiency

### 3. Reward System

- **Position-based rewards**: 1st, 2nd, 3rd place, Top 10
- **Progress-based rewards**: Individual contribution milestones
- **Stable-wide rewards**: Earned by entire stable for achievements
- **Individual rewards**: Personal achievement badges

## Database Schema

### Core Tables

#### `global_challenges`

Stores information about global challenges that all stables participate in.

```sql
- id: TEXT (e.g., "global_monthly_2025_09")
- title: TEXT
- description: TEXT
- icon: TEXT
- start_date: TIMESTAMPTZ
- end_date: TIMESTAMPTZ
- is_active: BOOLEAN
- target_distance: DECIMAL(10,2)
- unit: TEXT ('km' | 'mi')
- challenge_type: TEXT ('weekly' | 'monthly' | 'special')
- difficulty: TEXT ('easy' | 'medium' | 'hard' | 'extreme')
```

#### `stable_challenge_progress`

Tracks each stable's progress and ranking in global challenges.

```sql
- challenge_id: TEXT (FK to global_challenges)
- stable_id: UUID (FK to stables)
- stable_name: TEXT (denormalized for performance)
- progress_value: DECIMAL(10,2) (total stable progress)
- member_count: INTEGER (active contributors)
- average_contribution: DECIMAL(10,2) (average per member)
- rank: INTEGER (auto-calculated ranking)
- completed_at: TIMESTAMPTZ (when target reached)
```

#### `individual_stable_contributions`

Tracks individual user contributions to their stable's progress.

```sql
- challenge_id: TEXT (FK to global_challenges)
- stable_id: UUID (FK to stables)
- user_id: UUID (FK to auth.users)
- contribution: DECIMAL(10,2) (user's total distance)
- session_count: INTEGER (number of sessions)
- last_activity_date: TIMESTAMPTZ
```

## API Usage

### Getting Global Challenges

```typescript
import { GlobalChallengeAPI } from "../lib/globalChallengeAPI";

// Get all active global challenges
const challenges = await GlobalChallengeAPI.getActiveGlobalChallenges();

// Get current monthly challenge
const monthlyChallenge = await GlobalChallengeAPI.getCurrentMonthlyChallenge();

// Get global leaderboard for a challenge
const leaderboard = await GlobalChallengeAPI.getGlobalLeaderboard(
  challengeId,
  userId
);
```

### Adding User Progress

```typescript
// Add distance from a riding session
const success = await GlobalChallengeAPI.addDistanceToGlobalChallenge(
  userId,
  distanceInKm,
  sessionCount
);

// Get user's active global challenge
const userChallenge = await GlobalChallengeAPI.getUserActiveGlobalChallenge(
  userId
);
```

### Viewing Stable Performance

```typescript
// Get contributors for a specific stable
const contributors = await GlobalChallengeAPI.getStableContributors(
  challengeId,
  stableId
);

// Get challenge statistics
const stats = await GlobalChallengeAPI.getChallengeStatistics(challengeId);

// Get top performers across all stables
const topPerformers = await GlobalChallengeAPI.getTopPerformers(
  challengeId,
  10
);
```

## Component Integration

### Global Challenge Display

```typescript
import { useState, useEffect } from "react";
import { GlobalChallengeAPI } from "../lib/globalChallengeAPI";

const GlobalChallengeScreen = () => {
  const [challenge, setChallenge] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userChallenge, setUserChallenge] = useState(null);

  useEffect(() => {
    loadGlobalChallenge();
  }, []);

  const loadGlobalChallenge = async () => {
    const currentChallenge =
      await GlobalChallengeAPI.getCurrentMonthlyChallenge();
    if (currentChallenge) {
      setChallenge(currentChallenge);
      setLeaderboard(currentChallenge.globalLeaderboard);

      const userActive = await GlobalChallengeAPI.getUserActiveGlobalChallenge(
        userId
      );
      setUserChallenge(userActive);
    }
  };

  return (
    <View>
      {/* Challenge header */}
      <Text>{challenge?.title}</Text>
      <Text>{challenge?.description}</Text>

      {/* User's stable progress */}
      {userChallenge && (
        <View>
          <Text>Your Stable: {userChallenge.stableName}</Text>
          <Text>Rank: #{userChallenge.stableRank}</Text>
          <Text>Your Contribution: {userChallenge.userContribution} km</Text>
          <Text>Stable Total: {userChallenge.stableProgress} km</Text>
        </View>
      )}

      {/* Global leaderboard */}
      <FlatList
        data={leaderboard}
        renderItem={({ item }) => (
          <View>
            <Text>
              #{item.rank} {item.stableName}
            </Text>
            <Text>
              {item.progressValue} km ({item.memberCount} members)
            </Text>
            <Text>Avg: {item.averageContribution} km/member</Text>
          </View>
        )}
      />
    </View>
  );
};
```

### Adding Session Progress

```typescript
const addSessionToChallenge = async (sessionData) => {
  const success = await GlobalChallengeAPI.addDistanceToGlobalChallenge(
    userId,
    sessionData.distance,
    1 // session count
  );

  if (success) {
    // Refresh challenge data
    await loadGlobalChallenge();

    // Show success message
    showNotification("Progress added to global challenge!");
  }
};
```

## Ranking Algorithm

The global leaderboard uses a sophisticated ranking system:

1. **Primary**: Total progress value (sum of all member contributions)
2. **Secondary**: Average contribution per member (efficiency)
3. **Tertiary**: Last updated timestamp (earlier updates get priority in ties)

This ensures both large and small stables can compete fairly while rewarding consistent participation.

## Migration from Old System

The new global system coexists with the old stable-specific challenges:

### Database Migration

1. Run `create_global_stable_challenges.sql` migration
2. Existing `stable_challenges` table remains for backward compatibility
3. New tables handle global competition

### API Integration

1. Use `GlobalChallengeAPI` for new global features
2. Keep `StableChallengeAPI` for legacy stable-only challenges
3. Gradually migrate screens to use global system

### Data Migration

- Existing stable challenge data is preserved
- New global challenges start fresh each month
- Users can participate in both systems during transition

## Best Practices

### Performance

- Use database functions for complex ranking calculations
- Cache leaderboard data when possible
- Use real-time subscriptions for live updates

### User Experience

- Show both individual and stable progress clearly
- Highlight user's stable in the global leaderboard
- Provide context about ranking algorithm
- Celebrate both individual and team achievements

### Security

- Row Level Security (RLS) policies protect user data
- Users can only update their own contributions
- Leaderboard data is publicly readable for competition transparency

## Monthly Reset Process

Global challenges automatically reset monthly:

1. **Database function** `create_monthly_global_challenge()` creates new challenges
2. **Auto-enrollment** function adds all active stables
3. **Previous month data** is preserved for historical analysis
4. **Rewards are distributed** based on final rankings

## Monitoring and Analytics

Track key metrics:

- Participation rates across stables
- Average contributions per stable
- Challenge completion rates
- User engagement patterns
- Reward distribution

This data helps optimize future challenge design and maintain competitive balance.
