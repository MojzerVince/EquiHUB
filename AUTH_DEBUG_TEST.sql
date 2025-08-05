-- Test to check authentication mismatch
-- Run this in your Supabase SQL Editor while the app is running

-- 1. What is auth.uid() when run directly in SQL editor?
SELECT auth.uid() as sql_editor_auth_uid;

-- 2. Let's create a simple function that logs what auth.uid() returns
CREATE OR REPLACE FUNCTION get_horses_with_auth_debug(requested_user_id uuid)
RETURNS TABLE(
  auth_uid uuid,
  requested_uid uuid,
  horses_count bigint,
  auth_match boolean
)
LANGUAGE sql
SECURITY definer
AS $$
  SELECT 
    auth.uid() as auth_uid,
    requested_user_id as requested_uid,
    (SELECT COUNT(*) FROM horses WHERE user_id = requested_user_id) as horses_count,
    (auth.uid() = requested_user_id) as auth_match;
$$;

-- 3. Test the function
SELECT * FROM get_horses_with_auth_debug('efab7495-b514-4c6d-9c83-f17c3afdf3ae'::uuid);

-- 4. Let's also create a function that bypasses RLS to test the data
CREATE OR REPLACE FUNCTION get_all_horses_admin()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  auth_uid uuid
)
LANGUAGE sql
SECURITY definer
AS $$
  SELECT h.id, h.user_id, h.name, auth.uid() as auth_uid
  FROM horses h;
$$;

-- 5. Test admin function
SELECT * FROM get_all_horses_admin();
