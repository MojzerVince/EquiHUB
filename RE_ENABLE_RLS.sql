-- Re-enable RLS now that horses are loading via direct API
-- Since we're using the anon key, we need simpler policies

-- Re-enable RLS on horses table
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own horses" ON horses;
DROP POLICY IF EXISTS "Users can insert their own horses" ON horses;
DROP POLICY IF EXISTS "Users can update their own horses" ON horses;
DROP POLICY IF EXISTS "Users can delete their own horses" ON horses;
DROP POLICY IF EXISTS "Allow authenticated users to view horses" ON horses;
DROP POLICY IF EXISTS "Allow authenticated users to insert horses" ON horses;
DROP POLICY IF EXISTS "Allow authenticated users to update their horses" ON horses;
DROP POLICY IF EXISTS "Allow authenticated users to delete their horses" ON horses;

-- Create simple policies that work with the anon key and direct API calls
-- Since we're using direct API with anon key, we need more permissive policies for now

-- Allow anon role to read all horses (we filter by user_id in the application)
CREATE POLICY "Allow anon to read horses" ON horses
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon role to insert horses
CREATE POLICY "Allow anon to insert horses" ON horses
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon role to update horses
CREATE POLICY "Allow anon to update horses" ON horses
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon role to delete horses
CREATE POLICY "Allow anon to delete horses" ON horses
  FOR DELETE
  TO anon
  USING (true);

-- Test that the policy works
SELECT * FROM horses WHERE user_id = 'efab7495-b514-4c6d-9c83-f17c3afdf3ae';
