-- Verification script for stables tables migration
-- Run this after executing create_stables_tables.sql

-- Check if stables table exists and has correct structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'stables'
ORDER BY ordinal_position;

-- Check if stable_members table exists and has correct structure  
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'stable_members'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND (tablename = 'stables' OR tablename = 'stable_members')
ORDER BY tablename, indexname;

-- Check foreign key constraints
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND (tc.table_name = 'stables' OR tc.table_name = 'stable_members');

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND (tablename = 'stables' OR tablename = 'stable_members')
ORDER BY tablename, policyname;

-- Test basic functionality by creating a sample stable (optional)
-- Uncomment the following lines to test:

/*
-- Insert a test stable
INSERT INTO public.stables (name, location, city, state_province, description)
VALUES ('Test Stable', '123 Horse Lane', 'Horsetown', 'TX', 'A test stable for verification');

-- Check if it was created
SELECT * FROM public.stables WHERE name = 'Test Stable';

-- Clean up test data
DELETE FROM public.stables WHERE name = 'Test Stable';
*/

-- Summary query to confirm everything is working
SELECT 
  'stables' as table_name,
  COUNT(*) as row_count
FROM public.stables
UNION ALL
SELECT 
  'stable_members' as table_name,
  COUNT(*) as row_count  
FROM public.stable_members;
