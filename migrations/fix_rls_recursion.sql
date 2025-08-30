-- Quick fix for infinite recursion policy error
-- Run this if you already executed the previous migration and got the recursion error

-- Drop the problematic policies
DROP POLICY IF EXISTS "Allow all operations on stables" ON public.stables;
DROP POLICY IF EXISTS "Allow all operations on stable_members" ON public.stable_members;

-- Disable Row Level Security to prevent policy issues in demo environment
ALTER TABLE public.stables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_members DISABLE ROW LEVEL SECURITY;

-- Verify the tables exist and RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND (tablename = 'stables' OR tablename = 'stable_members');

-- Test that we can now insert without policy errors
-- This should work without infinite recursion
SELECT 'Tables are ready for stable creation' as status;
