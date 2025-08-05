-- Create a simple function to check what auth.uid() returns
-- Run this in your Supabase SQL Editor

-- Create a function to return the current auth.uid()
CREATE OR REPLACE FUNCTION auth_uid_check()
RETURNS uuid
LANGUAGE sql
SECURITY definer
AS $$
  SELECT auth.uid();
$$;

-- Test the function
SELECT auth_uid_check() as current_authenticated_user;
