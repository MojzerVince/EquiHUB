-- Fix RLS policies for the horses table
-- Run this in your Supabase SQL Editor to fix the infinite loading issue

-- First, check if RLS is enabled on the horses table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'horses';

-- Enable RLS on the horses table (if not already enabled)
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own horses" ON horses;
DROP POLICY IF EXISTS "Users can insert their own horses" ON horses;
DROP POLICY IF EXISTS "Users can update their own horses" ON horses;
DROP POLICY IF EXISTS "Users can delete their own horses" ON horses;

-- Create RLS policies for the horses table
-- Allow users to SELECT their own horses
CREATE POLICY "Users can view their own horses" ON horses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to INSERT their own horses
CREATE POLICY "Users can insert their own horses" ON horses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own horses
CREATE POLICY "Users can update their own horses" ON horses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own horses
CREATE POLICY "Users can delete their own horses" ON horses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'horses';

-- Test query to make sure it works
-- This should return horses for the current authenticated user
SELECT * FROM horses WHERE user_id = auth.uid();
