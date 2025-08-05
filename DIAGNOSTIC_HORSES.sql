-- Diagnostic script to test Supabase connection and RLS policies
-- Run this step by step in your Supabase SQL Editor

-- 1. First, let's check if the horses table exists and its structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'horses' 
ORDER BY ordinal_position;

-- 2. Check if RLS is enabled on the horses table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'horses';

-- 3. Check what RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'horses';

-- 4. Check current authenticated user (this should return your user ID)
SELECT auth.uid() as current_user_id;

-- 5. Check all users in the auth.users table
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at;

-- 6. Check if any horses exist in the table (without RLS filtering)
-- This requires BYPASS RLS privilege or should be run as service_role
-- If this fails, there might be no horses in the table at all
SELECT COUNT(*) as total_horses FROM horses;

-- 7. Check horses for specific user (this will use RLS)
SELECT * FROM horses WHERE user_id = 'efab7495-b514-4c6d-9c83-f17c3afdf3ae';

-- 8. Try to insert the test horse if it doesn't exist
INSERT INTO horses (
  id,
  user_id,
  name,
  gender,
  birth_date,
  breed,
  height,
  weight,
  image_url,
  created_at,
  updated_at
) VALUES (
  'a7b8c9d0-e1f2-4a5b-8c9d-0e1f2a3b4c5d',
  'efab7495-b514-4c6d-9c83-f17c3afdf3ae',
  'Thunder',
  'Stallion',
  '2018-03-15'::date,
  'Arabian',
  152,
  1100,
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 9. Final check - try to select horses for the authenticated user
SELECT * FROM horses WHERE user_id = auth.uid();
