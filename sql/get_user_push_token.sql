-- Create a function to get push token for any user (bypassing RLS)
-- This should be run in your Supabase SQL editor

CREATE OR REPLACE FUNCTION get_user_push_token(target_user_id uuid)
RETURNS TABLE (
  push_token text,
  is_active boolean,
  user_id uuid
) 
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT push_token, is_active, user_id
  FROM user_push_tokens
  WHERE user_id = target_user_id 
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_push_token(uuid) TO authenticated;