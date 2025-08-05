-- Alternative RLS policy approach that might work better
-- Run this AFTER the temporary disable test works

-- Re-enable RLS
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own horses" ON horses;
DROP POLICY IF EXISTS "Users can insert their own horses" ON horses;
DROP POLICY IF EXISTS "Users can update their own horses" ON horses;
DROP POLICY IF EXISTS "Users can delete their own horses" ON horses;

-- Create a more permissive policy for testing
-- This allows all authenticated users to see all horses (less secure but for debugging)
CREATE POLICY "Allow authenticated users to view horses" ON horses
  FOR SELECT
  TO authenticated
  USING (true);

-- Create insert policy for authenticated users
CREATE POLICY "Allow authenticated users to insert horses" ON horses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create update policy
CREATE POLICY "Allow authenticated users to update their horses" ON horses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create delete policy
CREATE POLICY "Allow authenticated users to delete their horses" ON horses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Test the new policy
SELECT * FROM horses;
