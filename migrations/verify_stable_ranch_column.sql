-- Verification script for profiles table column migration
-- Run this after executing the add_stable_ranch_column.sql migration

-- Check if all the new columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name IN ('stable_ranch', 'experience', 'is_pro_member');

-- Check if the indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname IN ('idx_profiles_stable_ranch', 'idx_profiles_experience', 'idx_profiles_is_pro_member');

-- Show all columns in the profiles table to confirm complete structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show a sample of the data to confirm structure
SELECT 
    id,
    name,
    age,
    experience,
    is_pro_member,
    stable_ranch,
    created_at
FROM public.profiles 
LIMIT 5;
