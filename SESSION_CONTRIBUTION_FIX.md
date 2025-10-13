# Session Contribution Bug Fix

## Problem

After completing a tracking session with 9 meters of distance, the contribution was not being added to the global stable challenge. The log showed:

```
LOG  Added 0.01km to stable challenge
```

But the challenge progress remained at `0m/1.00km`.

## Root Cause

The tracking session code in `app/(tabs)/map.tsx` was calling the **OLD** stable challenge system:

```typescript
await StableChallengeAPI.addDistanceToStableChallenge(user.id, distanceInKm);
```

However, this system was **disabled** in `app/(tabs)/community.tsx` (lines 546-605) with this note:

```typescript
// Disable stable challenge loading - using global challenges instead
console.log("Stable challenge loading disabled - using global challenges");
```

The app is supposed to use the **NEW** global challenge system, but the map tracking code was never updated.

## Solution

Updated `app/(tabs)/map.tsx` (around line 1914) to use the global challenge API instead:

### Before:

```typescript
// Automatically contribute to stable challenge if user is in a stable
if (user?.id && session.distance && session.distance > 0) {
  try {
    // Convert meters to kilometers for stable challenge
    const distanceInKm = session.distance / 1000;
    await StableChallengeAPI.addDistanceToStableChallenge(
      user.id,
      distanceInKm
    );
    console.log(`Added ${distanceInKm.toFixed(2)}km to stable challenge`);
  } catch (error) {
    console.error("Error adding distance to stable challenge:", error);
  }
}
```

### After:

```typescript
// Automatically contribute to global challenge if user is in a stable
if (user?.id && session.distance && session.distance > 0) {
  try {
    // Convert meters to kilometers for global challenge
    const distanceInKm = session.distance / 1000;
    const success = await GlobalChallengeAPI.addDistanceToGlobalChallenge(
      user.id,
      distanceInKm,
      1 // session count
    );
    if (success) {
      console.log(`✅ Added ${distanceInKm.toFixed(2)}km to global challenge`);
    } else {
      console.log(
        `⚠️ Could not add distance to global challenge (user may not be in a stable or no active challenge)`
      );
    }
  } catch (error) {
    console.error("❌ Error adding distance to global challenge:", error);
  }
}
```

## Changes Made

1. **Updated API call**: Changed from `StableChallengeAPI.addDistanceToStableChallenge()` to `GlobalChallengeAPI.addDistanceToGlobalChallenge()`

2. **Added import**: Added `import { GlobalChallengeAPI } from "../../lib/globalChallengeAPI";` at the top of map.tsx

3. **Improved logging**:

   - Success: `✅ Added X.XXkm to global challenge`
   - Warning: `⚠️ Could not add distance...` (when user not in stable or no active challenge)
   - Error: `❌ Error adding distance...` (when exception occurs)

4. **Added session count**: Now passes `1` as the session count parameter to properly track number of sessions contributed

## How Global Challenge Works

When `GlobalChallengeAPI.addDistanceToGlobalChallenge()` is called, it:

1. **Checks user's stable membership**: Queries `stable_members` table
2. **Gets current active challenge**: Finds monthly challenge where current date is between start_date and end_date
3. **Updates individual contribution**: Upserts into `individual_stable_contributions` table
4. **Triggers automatic update**: Database triggers update the `stable_challenge_progress` table automatically
5. **Recalculates rankings**: Leaderboard is dynamically calculated from all contributions

## Testing

After this fix, when you complete a tracking session:

1. **Expected log message**: `✅ Added 0.01km to global challenge` (or actual distance)
2. **Expected behavior**:
   - Your personal contribution increases in the global challenge
   - Your stable's total progress increases
   - Leaderboard updates automatically (refreshes every 30 seconds)
3. **Check in Community tab**:
   - Tap "Challenges" tab
   - See "October Riding Challenge" (if it exists and is active)
   - Your stable's progress should show updated distance

## Prerequisites for Contribution to Work

For contributions to be recorded, ALL of these must be true:

✅ User must be logged in (`user?.id` exists)  
✅ Session must have distance > 0  
✅ User must be a member of an active stable (`stable_members.is_active = true`)  
✅ There must be an active global challenge with `challenge_type = 'monthly'`  
✅ Current date must be between challenge's `start_date` and `end_date`  
✅ Challenge must have `is_active = true`

If any of these conditions are not met, the function returns `false` and logs the warning message.

## Migration Note

The old `StableChallengeAPI` is now **deprecated** and should not be used. All new code should use `GlobalChallengeAPI` instead.

If you see references to `StableChallengeAPI` in other parts of the codebase, they should be updated to use `GlobalChallengeAPI`.

## Related Files

- `app/(tabs)/map.tsx` - Tracking session logic (FIXED)
- `lib/globalChallengeAPI.ts` - Global challenge API implementation
- `lib/stableChallengeAPI.ts` - Old stable challenge API (deprecated)
- `app/(tabs)/community.tsx` - Challenge display UI
- `migrations/create_global_stable_challenges.sql` - Database schema for global challenges

## Next Steps

1. **Test the fix**: Complete a tracking session and verify the contribution appears in the global challenge
2. **Ensure October challenge exists**: Run the SQL queries in `debug_global_challenges.sql` to verify the October challenge is set up correctly
3. **Monitor logs**: Watch for the new emoji log messages to confirm contributions are working
