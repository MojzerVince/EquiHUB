-- Add Google OAuth support to profiles table
-- This migration adds google_id column to store Google account IDs

-- Add google_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='google_id') THEN
        ALTER TABLE profiles ADD COLUMN google_id TEXT UNIQUE;
    END IF;
END $$;

-- Create index on google_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON profiles(google_id);

-- Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Users can view own profile via google_id" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile via google_id" ON profiles;
DROP POLICY IF EXISTS "Allow Google OAuth user creation" ON profiles;

-- Create RLS policies for Google OAuth users
-- Note: These policies are permissive for server-side Google OAuth operations
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT USING (
        -- Allow service role (server) to read all profiles for OAuth operations
        auth.jwt() ->> 'role' = 'service_role'
        -- Allow authenticated users to read their own profiles
        OR (auth.uid() IS NOT NULL AND auth.uid()::text = id::text)
    );

CREATE POLICY "profiles_insert_policy" ON profiles
    FOR INSERT WITH CHECK (
        -- Allow service role (server) to create profiles for Google OAuth
        auth.jwt() ->> 'role' = 'service_role'
        -- Allow authenticated users to create their own profiles
        OR (auth.uid() IS NOT NULL AND auth.uid()::text = id::text)
    );

CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE USING (
        -- Allow service role (server) to update profiles for Google OAuth
        auth.jwt() ->> 'role' = 'service_role'
        -- Allow authenticated users to update their own profiles
        OR (auth.uid() IS NOT NULL AND auth.uid()::text = id::text)
    );

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
    AND column_name = 'google_id';