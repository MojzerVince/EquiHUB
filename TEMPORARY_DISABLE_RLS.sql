-- Temporary fix: Disable RLS to test if horses can be loaded
-- This will help us confirm if the issue is purely authentication-related
-- DO NOT LEAVE THIS IN PRODUCTION - this bypasses security

-- 1. Temporarily disable RLS on horses table
ALTER TABLE horses DISABLE ROW LEVEL SECURITY;

-- 2. Test query without RLS (this should work now)
SELECT * FROM horses WHERE user_id = 'efab7495-b514-4c6d-9c83-f17c3afdf3ae';

-- 3. After testing, we'll re-enable RLS with a different approach
