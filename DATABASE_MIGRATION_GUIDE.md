# Database Migration Fix for Global Challenges

## The Problem

You're getting this error when trying to add distance to global challenges:

```
ERROR  Error adding distance to global challenge:
{"code": "42P01", "details": null, "hint": null,
"message": "relation \"public.stable_challenge_progress\" does not exist"}
```

## Root Cause

Your database is **missing the `stable_challenge_progress` table** and its associated triggers.

When a session is saved and calls `GlobalChallengeAPI.addDistanceToGlobalChallenge()`, it inserts a row into the `individual_stable_contributions` table. This table has a **database trigger** that automatically:

1. Calculates total stable progress from all individual contributions
2. Updates the `stable_challenge_progress` table with aggregated data
3. Recalculates rankings across all stables

But since the `stable_challenge_progress` table doesn't exist, the trigger fails and the entire transaction rolls back.

## The Fix - Run This Migration

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2: Run the Migration

Copy and paste the **entire contents** of `MINIMAL_MIGRATION_FIX.sql` into the SQL Editor and click **Run**.

This will create:

- ✅ `stable_challenge_progress` table
- ✅ Indexes for performance
- ✅ Trigger function `update_stable_progress_from_contributions()`
- ✅ Ranking update function `update_global_challenge_rankings()`
- ✅ Database trigger `trigger_update_stable_progress`
- ✅ Auto-enroll function for stables
- ✅ RLS policies for security

### Step 3: Verify Migration Success

After running the migration, you should see:

```
status: "Tables created successfully!"
table_name: "stable_challenge_progress"
trigger_name: "trigger_update_stable_progress"
```

### Step 4: Create October Challenge (If Needed)

Run this SQL to create the October 2025 challenge:

```sql
-- Create October 2025 challenge
INSERT INTO public.global_challenges (
    id,
    title,
    description,
    icon,
    start_date,
    end_date,
    is_active,
    target_distance,
    unit,
    challenge_type,
    difficulty
) VALUES (
    'global_monthly_2025_10',
    'October Riding Challenge 2025',
    'All stables compete to see who can achieve the highest total distance in October 2025. Work together with your stable members to climb the global leaderboard!',
    '🍂',
    '2025-10-01 00:00:00+00',
    '2025-10-31 23:59:59+00',
    TRUE,
    1000.00,
    'km',
    'monthly',
    'medium'
) ON CONFLICT (id) DO UPDATE SET
    is_active = TRUE,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date;

-- Auto-enroll all stables in the challenge
SELECT auto_enroll_stables_in_global_challenge('global_monthly_2025_10');
```

### Step 5: Test the Fix

1. **Force close** your EquiHUB app completely
2. **Reopen** the app
3. **Complete a new tracking session** (even a short 10-meter walk)
4. **Watch the logs** - you should see:
   ```
   ✅ Added 0.01km to global challenge
   ```
5. **Check Community tab** → **Challenges** → Your stable's progress should increase!

## How It Works After Migration

### Automatic Progress Tracking

When you complete a session:

1. **Session saved** → `GlobalChallengeAPI.addDistanceToGlobalChallenge()` called
2. **Individual contribution recorded** → Row inserted/updated in `individual_stable_contributions`
3. **Trigger fires automatically** → `trigger_update_stable_progress` runs
4. **Stable progress calculated** → Aggregates all individual contributions for your stable
5. **Progress updated** → `stable_challenge_progress` table updated with totals
6. **Rankings recalculated** → All stables ranked by total progress
7. **Leaderboard updates** → App displays updated rankings

### Data Flow

```
Session Complete (9 meters)
    ↓
GlobalChallengeAPI.addDistanceToGlobalChallenge(user_id, 0.009km, 1)
    ↓
INSERT/UPDATE individual_stable_contributions
    challenge_id: 'global_monthly_2025_10'
    stable_id: [your stable's UUID]
    user_id: [your user UUID]
    contribution: 0.009 (cumulative)
    session_count: 1 (cumulative)
    ↓
TRIGGER: update_stable_progress_from_contributions()
    ↓
Calculate: SUM(all contributions for stable) = 0.009km
Calculate: COUNT(distinct users) = 1
Calculate: AVG(contribution per user) = 0.009km
    ↓
UPDATE stable_challenge_progress
    challenge_id: 'global_monthly_2025_10'
    stable_id: [your stable's UUID]
    progress_value: 0.009
    member_count: 1
    average_contribution: 0.009
    rank: [calculated based on all stables]
    ↓
App displays in Community → Challenges tab
```

## Tables Overview

### individual_stable_contributions

- **Purpose**: Tracks each user's personal contribution to their stable
- **Key columns**: `user_id`, `stable_id`, `challenge_id`, `contribution`, `session_count`
- **Updated by**: Your app code (GlobalChallengeAPI)

### stable_challenge_progress (NEWLY CREATED)

- **Purpose**: Aggregates all contributions for each stable
- **Key columns**: `stable_id`, `challenge_id`, `progress_value`, `member_count`, `rank`
- **Updated by**: Database trigger (automatically)

### global_challenges

- **Purpose**: Defines available challenges
- **Key columns**: `id`, `title`, `start_date`, `end_date`, `target_distance`, `is_active`
- **Updated by**: Manual SQL or admin functions

## Troubleshooting

### If you still get errors after migration:

1. **Check if migration ran successfully**:

   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'stable_challenge_progress';
   ```

   Should return: `stable_challenge_progress`

2. **Check if trigger exists**:

   ```sql
   SELECT trigger_name
   FROM information_schema.triggers
   WHERE event_object_table = 'individual_stable_contributions';
   ```

   Should return: `trigger_update_stable_progress`

3. **Check if you're in a stable**:

   ```sql
   SELECT stable_id, stables.name
   FROM stable_members
   JOIN stables ON stables.id = stable_members.stable_id
   WHERE user_id = '[YOUR_USER_ID]'
   AND is_active = TRUE;
   ```

   Should return your stable info

4. **Check if October challenge exists**:
   ```sql
   SELECT id, title, start_date, end_date, is_active
   FROM global_challenges
   WHERE challenge_type = 'monthly'
   AND start_date <= NOW()
   AND end_date >= NOW()
   AND is_active = TRUE;
   ```
   Should return: `global_monthly_2025_10`

### Common Issues

| Error                                                        | Cause                                     | Solution                                   |
| ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------ |
| `relation "public.stable_challenge_progress" does not exist` | Migration not run                         | Run MINIMAL_MIGRATION_FIX.sql              |
| `⚠️ Could not add distance to global challenge`              | No active challenge OR user not in stable | Create October challenge / Join a stable   |
| `No active global challenge found`                           | Challenge dates don't include today       | Update challenge dates to include Oct 2025 |
| Contribution = 0 in leaderboard                              | Trigger not firing                        | Check trigger exists, check RLS policies   |

## Expected Behavior After Fix

### ✅ What You Should See

1. **In Logs**:

   ```
   ✅ Added 0.01km to global challenge
   ```

2. **In Community Tab → Challenges**:

   - October Riding Challenge 2025 card visible
   - Your stable name displayed
   - Progress bar showing 0.01km / 1.00km
   - Rank #1 (if your stable is first)

3. **In Leaderboard**:
   - Your stable listed
   - Total distance: 0.01km
   - Member count: 1
   - Average contribution: 0.01km

### ❌ What You Should NOT See

- ❌ `relation "public.stable_challenge_progress" does not exist`
- ❌ Progress staying at 0m/1.00km after completing sessions
- ❌ Empty Challenges tab (if challenge exists and is active)

## Migration is Complete When...

- [ ] `MINIMAL_MIGRATION_FIX.sql` ran without errors
- [ ] Verification queries show table and trigger exist
- [ ] October 2025 challenge created and active
- [ ] User is a member of an active stable
- [ ] New tracking session shows `✅ Added X.XXkm to global challenge`
- [ ] Community → Challenges tab shows updated progress
- [ ] Leaderboard displays your stable with correct distance

## Next Steps After Migration

1. ✅ **Run MINIMAL_MIGRATION_FIX.sql** in Supabase
2. ✅ **Create October challenge** (if needed)
3. ✅ **Join a stable** (if not already a member)
4. ✅ **Complete a test session**
5. ✅ **Verify progress updates** in app
6. ✅ **Check leaderboard** shows your stable

---

**Need Help?** Check the verification queries in the troubleshooting section above.
