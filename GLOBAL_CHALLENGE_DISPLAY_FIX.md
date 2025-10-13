# Global Challenge Display Fix

## Issues Fixed

### 1. ❌ Duplicate "km" Units

**Problem:** App displayed "0 m / 1.00 km km" and "0m km"
**Root Cause:** The `formatDistance()` function already includes the unit (e.g., "1.00 km"), but the code was adding `formatDistanceUnit()` again, resulting in "1.00 km km"

**Fix Applied:**

- Removed all `{formatDistanceUnit()}` calls after `formatDistance()`
- Files changed: `app/(tabs)/community.tsx` (lines 2596-2611 and 2690-2695)

### 2. ❌ Wrong Target Distance (1.00 km instead of 1000 km)

**Problem:** Database has target_distance = 1000.00 (in km), but app showed 1.00 km
**Root Cause:** The `formatDistance()` function expects values in **meters**, but the database stores distances in **kilometers**. When we passed 1000 (km) to `formatDistance()`, it interpreted it as 1000 meters = 1.00 km.

**Fix Applied:**

- Multiply all km values by 1000 before passing to `formatDistance()`
- Changed: `formatDistance(value)` → `formatDistance(value * 1000)`
- Applied to:
  - `stableProgress` (line 2596)
  - `targetDistance` (line 2597)
  - `userContribution` (line 2610)
  - `progressValue` in leaderboard (line 2690)
  - `averageContribution` in leaderboard (line 2692)

### 3. 🔍 Challenge Not Showing in App

**Problem:** Database has contributions (0.08 km, 3 sessions) but challenge doesn't appear in app
**Possible Causes:**

1. Challenge dates don't include current date (Oct 13, 2025)
2. Challenge `is_active = FALSE`
3. Challenge `challenge_type` is not 'monthly'
4. User not in an active stable
5. API query filters are too restrictive

**Fix Applied:**

- Added comprehensive logging to track the entire flow:
  - `GlobalChallengeAPI.getActiveGlobalChallenges()` - Shows what challenges are returned from DB
  - `GlobalChallengeAPI.getCurrentMonthlyChallenge()` - Shows if monthly challenge is found
  - `community.tsx loadGlobalChallenge()` - Shows complete loading process

## How to Debug

### Step 1: Check the Logs

After opening the Community tab → Challenges, you should see these logs:

```
🌍 Loading global challenge for user: [user-id]
📥 Fetching current monthly challenge...
🔍 Querying active global challenges with date: 2025-10-13T...
📊 Raw query result: { dataCount: X, error: 'none' }
📋 Challenges found: [array of challenges]
🗓️ Getting current monthly challenge...
✅ Monthly challenge found: { id: '...', title: '...', targetDistance: 1000 }
👤 Fetching user's active global challenge...
✅ Active global challenge: { challengeId: '...', stableId: '...', ... }
✅ Global challenge loaded successfully!
```

### Step 2: Identify the Issue

#### If you see: `📊 Raw query result: { dataCount: 0, error: 'none' }`

**Problem:** No challenges match the query filters
**Solution:** Check your database:

```sql
-- Check if challenge exists and dates are correct
SELECT
    id,
    title,
    challenge_type,
    is_active,
    start_date,
    end_date,
    CASE
        WHEN start_date <= NOW() AND end_date >= NOW() AND is_active = TRUE
        THEN '✅ ACTIVE'
        ELSE '❌ INACTIVE'
    END as status
FROM global_challenges
WHERE id = 'global_october';
```

**Expected Result:**

- `is_active` = TRUE
- `start_date` <= October 13, 2025
- `end_date` >= October 13, 2025
- `challenge_type` = 'monthly'

**If dates are wrong, fix with:**

```sql
UPDATE global_challenges
SET
    start_date = '2025-10-01 00:00:00+00',
    end_date = '2025-10-31 23:59:59+00',
    is_active = TRUE,
    challenge_type = 'monthly'
WHERE id = 'global_october';
```

#### If you see: `❌ No monthly challenge found. Available challenge types: [...]`

**Problem:** Challenge exists but `challenge_type` is not 'monthly'
**Solution:**

```sql
UPDATE global_challenges
SET challenge_type = 'monthly'
WHERE id = 'global_october';
```

#### If you see: `⚠️ Challenge found but user has no active challenge (not in a stable?)`

**Problem:** User is not a member of an active stable
**Solution:** Check stable membership:

```sql
SELECT
    sm.stable_id,
    sm.is_active as member_active,
    s.name as stable_name,
    s.is_active as stable_active
FROM stable_members sm
JOIN stables s ON s.id = sm.stable_id
WHERE sm.user_id = '[your-user-id]';
```

**If not in a stable, join one via the app or SQL:**

```sql
INSERT INTO stable_members (stable_id, user_id, role, is_active)
VALUES ('[stable-id]', '[user-id]', 'member', TRUE);
```

### Step 3: Verify Your Data

Based on your screenshot, you have:

- `challenge_id`: `d7f401da-2dba-4dde-9a33-65877ecd50a` → This should be `global_october` or similar
- `user_id`: `d2926fac-b6cd-48b7-b3a6-f30ad...`
- `stable_id`: `4f93b9e-09d9-470a-abff-7f90ae...`
- `contribution`: 0.08 km
- `session_count`: 3

**Check if challenge ID is correct:**

```sql
SELECT id, title FROM global_challenges;
```

**If IDs don't match, you may have multiple challenges. The app looks for:**

- `challenge_type = 'monthly'`
- `is_active = TRUE`
- `start_date <= NOW()`
- `end_date >= NOW()`

## Expected Behavior After Fix

### ✅ Display Format

- **Before:** "Stable: 0 m / 1.00 km km"
- **After:** "Stable: 80 m / 1000 km"

- **Before:** "Your contribution: 0m km"
- **After:** "Your contribution: 80 m"

- **Before:** Leaderboard: "0.08 km km"
- **After:** Leaderboard: "80 m"

### ✅ Challenge Appears When

1. Challenge exists in database
2. `is_active = TRUE`
3. Current date is between `start_date` and `end_date`
4. `challenge_type = 'monthly'`
5. User is a member of an active stable

### ✅ Progress Bar

- Should show: 80m / 1000km = 0.008% progress (tiny sliver)
- Formula: `(stableProgress / targetDistance) * 100`
- With values: `(0.08 / 1000) * 100 = 0.008%`

## Testing Steps

1. **Force close** the EquiHUB app
2. **Reopen** the app
3. **Navigate to** Community tab → Challenges
4. **Check console logs** for the debugging output
5. **Verify display:**
   - No duplicate "km km"
   - Target shows 1000 km (not 1.00 km)
   - Your contribution shows 80 m (not 0m)
   - Progress bar shows tiny sliver (0.008%)

## Common Issues & Solutions

| Log Message                          | Issue                     | Solution                          |
| ------------------------------------ | ------------------------- | --------------------------------- |
| `dataCount: 0`                       | No challenges match query | Fix challenge dates/active status |
| `No monthly challenge found`         | Wrong challenge_type      | Set challenge_type = 'monthly'    |
| `User has no active challenge`       | Not in stable             | Join a stable                     |
| `Raw query result: { error: '...' }` | Database error            | Check Supabase logs               |
| Challenge shows but progress = 0     | Contribution not linked   | Check challenge_id matches        |

## Files Modified

### app/(tabs)/community.tsx

- **Lines 2596-2611**: Fixed duplicate km in progress display
- **Lines 2690-2695**: Fixed duplicate km in leaderboard
- **Lines 628-665**: Added comprehensive logging to loadGlobalChallenge()

### lib/globalChallengeAPI.ts

- **Lines 8-40**: Added logging to getActiveGlobalChallenges()
- **Lines 73-88**: Added logging to getCurrentMonthlyChallenge()

## Rollback Instructions

If you need to revert these changes:

```bash
git diff app/(tabs)/community.tsx
git diff lib/globalChallengeAPI.ts
git checkout app/(tabs)/community.tsx lib/globalChallengeAPI.ts
```

## Next Steps

1. ✅ **Test the fixes** - Open app and check Community → Challenges
2. ✅ **Review logs** - Look for the emoji-prefixed debug messages
3. ✅ **Check database** - Run verification queries above
4. ✅ **Complete a session** - Verify contribution updates correctly
5. ✅ **Report results** - Share the log output if issue persists

---

**Quick Diagnosis Checklist:**

- [ ] Challenge exists in global_challenges table
- [ ] challenge_type = 'monthly'
- [ ] is_active = TRUE
- [ ] start_date <= Oct 13, 2025
- [ ] end_date >= Oct 13, 2025
- [ ] User is member of active stable
- [ ] challenge_id in contributions matches challenge in global_challenges
- [ ] App shows correct distances without duplicate km
