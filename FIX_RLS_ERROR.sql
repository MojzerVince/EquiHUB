-- IMMEDIATE FIX for RLS Policy Violation Error
-- Run this in your Supabase SQL Editor to fix the registration error

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Step 2: Create a more permissive INSERT policy for registration
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    auth.role() = 'service_role' OR
    current_setting('role') = 'service_role'
  );

-- Step 3: Ensure the trigger function has proper permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, age, description, experience, is_pro_member)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'age')::INTEGER, 18),
    COALESCE(NEW.raw_user_meta_data->>'description', 'Equestrian enthusiast'),
    1,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 5: Verify the setup
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd, 
  qual
FROM pg_policies 
WHERE tablename = 'profiles';
