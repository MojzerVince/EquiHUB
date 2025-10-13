-- Quick Diagnostic Query for Global Challenge Not Showing

-- 1. Check if challenge exists and is properly configured
SELECT 
    id,
    title,
    challenge_type,
    is_active,
    start_date,
    end_date,
    target_distance,
    unit,
    NOW() as current_time,
    CASE 
        WHEN start_date <= NOW() AND end_date >= NOW() AND is_active = TRUE AND challenge_type = 'monthly'
        THEN '✅ WILL SHOW IN APP' 
        ELSE '❌ WILL NOT SHOW' 
    END as app_visibility,
    CASE 
        WHEN start_date > NOW() THEN '❌ Challenge starts in the future'
        WHEN end_date < NOW() THEN '❌ Challenge ended in the past'
        WHEN is_active = FALSE THEN '❌ Challenge is not active'
        WHEN challenge_type != 'monthly' THEN '❌ Challenge type is not monthly'
        ELSE '✅ All checks passed'
    END as status_reason
FROM global_challenges
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check your specific challenge from the screenshot
SELECT 
    id,
    title,
    challenge_type,
    is_active,
    start_date,
    end_date,
    target_distance
FROM global_challenges
WHERE id = 'd7f401da-2dba-4dde-9a33-65877ecd50a';

-- 3. Check user's stable membership
SELECT 
    sm.id as membership_id,
    sm.stable_id,
    s.name as stable_name,
    sm.user_id,
    p.name as user_name,
    sm.is_active as membership_active,
    s.is_active as stable_active,
    sm.role
FROM stable_members sm
JOIN stables s ON s.id = sm.stable_id
JOIN profiles p ON p.id = sm.user_id
WHERE sm.user_id = 'd2926fac-b6cd-48b7-b3a6-f30ad'  -- Replace with your user ID if different
ORDER BY sm.joined_at DESC
LIMIT 1;

-- 4. Check contributions
SELECT 
    isc.challenge_id,
    gc.title as challenge_title,
    gc.challenge_type,
    gc.is_active as challenge_active,
    isc.stable_id,
    s.name as stable_name,
    isc.user_id,
    p.name as user_name,
    isc.contribution,
    isc.session_count,
    isc.last_activity_date
FROM individual_stable_contributions isc
LEFT JOIN global_challenges gc ON gc.id = isc.challenge_id
LEFT JOIN stables s ON s.id = isc.stable_id
LEFT JOIN profiles p ON p.id = isc.user_id
WHERE isc.user_id = 'd2926fac-b6cd-48b7-b3a6-f30ad'  -- Replace with your user ID if different
ORDER BY isc.last_activity_date DESC
LIMIT 5;

-- 5. Count active monthly challenges (should be 1)
SELECT 
    COUNT(*) as count,
    STRING_AGG(id, ', ') as challenge_ids
FROM global_challenges
WHERE challenge_type = 'monthly'
AND is_active = TRUE
AND start_date <= NOW()
AND end_date >= NOW();

-- FIXES (uncomment and modify as needed):

-- Fix #1: If challenge exists but dates are wrong
/*
UPDATE global_challenges
SET 
    start_date = '2025-10-01 00:00:00+00',
    end_date = '2025-10-31 23:59:59+00',
    is_active = TRUE,
    challenge_type = 'monthly'
WHERE id = 'd7f401da-2dba-4dde-9a33-65877ecd50a';
*/

-- Fix #2: If challenge doesn't exist, create October 2025 challenge
/*
INSERT INTO global_challenges (
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
    'All stables compete to see who can achieve the highest total distance in October 2025!',
    '🍂',
    '2025-10-01 00:00:00+00',
    '2025-10-31 23:59:59+00',
    TRUE,
    1000.00,
    'km',
    'monthly',
    'medium'
);

-- Then migrate existing contributions to new challenge
UPDATE individual_stable_contributions
SET challenge_id = 'global_monthly_2025_10'
WHERE challenge_id = 'd7f401da-2dba-4dde-9a33-65877ecd50a';
*/

-- Fix #3: If not in a stable, join one (replace IDs)
/*
INSERT INTO stable_members (stable_id, user_id, role, is_active)
VALUES (
    '4f93b9e-09d9-470a-abff-7f90ae',  -- Your stable ID from screenshot
    'd2926fac-b6cd-48b7-b3a6-f30ad',  -- Your user ID from screenshot
    'member',
    TRUE
);
*/

-- Verification: After fixes, this should return your challenge
SELECT 
    gc.id,
    gc.title,
    gc.challenge_type,
    gc.is_active,
    gc.start_date,
    gc.end_date,
    isc.contribution,
    isc.session_count,
    sm.stable_id,
    s.name as stable_name
FROM global_challenges gc
LEFT JOIN individual_stable_contributions isc 
    ON isc.challenge_id = gc.id 
    AND isc.user_id = 'd2926fac-b6cd-48b7-b3a6-f30ad'
LEFT JOIN stable_members sm 
    ON sm.user_id = 'd2926fac-b6cd-48b7-b3a6-f30ad' 
    AND sm.is_active = TRUE
LEFT JOIN stables s 
    ON s.id = sm.stable_id
WHERE gc.challenge_type = 'monthly'
AND gc.is_active = TRUE
AND gc.start_date <= NOW()
AND gc.end_date >= NOW();
