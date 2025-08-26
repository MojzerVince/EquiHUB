# Friendships Table RLS Setup

This file contains the SQL commands to fix the Row Level Security (RLS) policies for the friendships table.

## Problem

The friendships table has RLS enabled but no proper policies, causing "row-level security policy violation" errors when trying to send friend requests.

## Solution

Run these SQL commands in your Supabase SQL Editor:

```sql
-- First, check if friendships table exists
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name = 'friendships' AND table_schema = 'public';

-- Check if RLS is enabled (alternative method)
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE tablename = 'friendships' AND schemaname = 'public';

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can send friend requests" ON friendships;
DROP POLICY IF EXISTS "Users can view their friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update their friendships" ON friendships;
DROP POLICY IF EXISTS "Users can delete their friendships" ON friendships;

-- Ensure the friendships table exists with proper structure
CREATE TABLE IF NOT EXISTS friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Enable Row Level Security
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for friendships table

-- 1. Allow users to INSERT friend requests (send friend requests)
CREATE POLICY "Users can send friend requests" ON friendships
    FOR INSERT WITH CHECK (
        auth.uid()::text = user_id::text OR
        auth.uid()::text = friend_id::text
    );

-- 2. Allow users to SELECT friendships they are part of
CREATE POLICY "Users can view their friendships" ON friendships
    FOR SELECT USING (
        auth.uid()::text = user_id::text OR
        auth.uid()::text = friend_id::text
    );

-- 3. Allow users to UPDATE friendships they are part of (accept/decline requests)
CREATE POLICY "Users can update their friendships" ON friendships
    FOR UPDATE USING (
        auth.uid()::text = user_id::text OR
        auth.uid()::text = friend_id::text
    );

-- 4. Allow users to DELETE friendships they are part of (unfriend)
CREATE POLICY "Users can delete their friendships" ON friendships
    FOR DELETE USING (
        auth.uid()::text = user_id::text OR
        auth.uid()::text = friend_id::text
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_friend ON friendships(user_id, friend_id);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS friendships_updated_at ON friendships;
CREATE TRIGGER friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_friendships_updated_at();
```

## Verify the Setup

After running the above SQL, verify it worked:

```sql
-- Check if policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'friendships';

-- Test the policies work by checking user permissions
SELECT has_table_privilege('friendships', 'INSERT') as can_insert,
       has_table_privilege('friendships', 'SELECT') as can_select,
       has_table_privilege('friendships', 'UPDATE') as can_update,
       has_table_privilege('friendships', 'DELETE') as can_delete;
```

## What This Fixes

✅ **INSERT Permission**: Users can now send friend requests  
✅ **SELECT Permission**: Users can view their own friendships  
✅ **UPDATE Permission**: Users can accept/decline friend requests  
✅ **DELETE Permission**: Users can unfriend others  
✅ **Performance**: Proper indexes for fast queries  
✅ **Auto Timestamps**: Automatic updated_at field updates

## Security Notes

- Users can only manage friendships where they are either the sender (user_id) or recipient (friend_id)
- The policies use `auth.uid()` which requires proper JWT authentication
- All operations are restricted to the authenticated user's own data
- The `CHECK` constraint ensures only valid status values

## Testing

After applying these changes, try the friend request functionality again. You should see:

1. No more RLS policy violation errors
2. Successful friend request creation
3. Proper logging showing the friendship was created
4. The success alert appearing in the app
