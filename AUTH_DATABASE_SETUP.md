# Authentication Database Setup

This file contains the SQL scripts needed to set up authentication and user profiles in Supabase.

## 1. Update Profiles Table

The profiles table needs to be updated to work with Supabase Auth. Run this in the SQL Editor:

```sql
-- Update the profiles table to work with Supabase Auth
-- First, drop the existing table if it exists (CAREFUL - this will delete data!)
-- DROP TABLE IF EXISTS profiles CASCADE;

-- Create or update profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 13 AND age <= 120),
  description TEXT DEFAULT 'Equestrian enthusiast',
  experience INTEGER DEFAULT 1 CHECK (experience >= 1),
  is_pro_member BOOLEAN DEFAULT FALSE,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro_member ON profiles(is_pro_member);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

## 2. Create RLS Policies for Profiles

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow users to view all profiles (for social features)
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);
```

## 3. Create Function to Handle New User Registration

This function automatically creates a profile when a new user signs up:

```sql
-- Function to handle new user signup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 4. Update Horses Table for Authentication

If you haven't already, update the horses table to work with authenticated users:

```sql
-- Update horses table to use auth user IDs
-- This assumes you already have a horses table
ALTER TABLE horses
  DROP CONSTRAINT IF EXISTS horses_user_id_fkey;

-- Add foreign key constraint to auth users
ALTER TABLE horses
  ADD CONSTRAINT horses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on horses table
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;

-- Create policies for horses
DROP POLICY IF EXISTS "Users can view their own horses" ON horses;
DROP POLICY IF EXISTS "Users can insert their own horses" ON horses;
DROP POLICY IF EXISTS "Users can update their own horses" ON horses;
DROP POLICY IF EXISTS "Users can delete their own horses" ON horses;

CREATE POLICY "Users can view their own horses" ON horses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own horses" ON horses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own horses" ON horses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own horses" ON horses
  FOR DELETE USING (auth.uid() = user_id);
```

## 5. Create Demo User (Optional)

Create a demo user for testing:

```sql
-- Insert demo user (this will be handled by the trigger)
-- You'll need to create this user through the Supabase Auth interface or your app
-- Email: demo@equihub.com
-- Password: demo123

-- Alternatively, you can create a demo profile manually if the user exists:
-- INSERT INTO profiles (id, name, age, description, experience, is_pro_member)
-- VALUES (
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   'Demo User',
--   25,
--   'This is a demo account for testing EquiHUB features.',
--   5,
--   TRUE
-- );
```

## 6. Update Storage Policies for Authentication

Update storage bucket policies to work with authenticated users:

```sql
-- Update storage policies for profile images
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update" ON storage.objects;

-- Allow authenticated users to view profile images
CREATE POLICY "Authenticated users can view profile images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'profile-images' AND
    auth.role() = 'authenticated'
  );

-- Allow users to upload their own profile images
CREATE POLICY "Users can upload own profile images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-images' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update their own profile images
CREATE POLICY "Users can update own profile images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-images' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own profile images
CREATE POLICY "Users can delete own profile images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-images' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

## 7. Test the Setup

After running all the above SQL, test your setup:

1. **Registration Test**: Try registering a new user through your app
2. **Login Test**: Try logging in with the registered user
3. **Profile Test**: Check that a profile was automatically created
4. **Data Access Test**: Ensure users can only access their own data

## 8. Important Notes

- **Email Confirmation**: By default, Supabase requires email confirmation. You can disable this in Authentication > Settings for testing
- **Password Requirements**: Supabase has default password requirements (6+ characters)
- **Rate Limiting**: Supabase has built-in rate limiting for auth operations
- **Custom Claims**: You can add custom claims to the JWT token if needed

## 9. Troubleshooting

- **Profile Not Created**: Check if the trigger is working by looking at the database logs
- **Access Denied**: Verify RLS policies are correctly set up
- **Storage Issues**: Make sure storage bucket exists and policies are correct
- **Auth Errors**: Check Supabase Auth logs in the dashboard

## 10. Security Considerations

- **Never expose service_role key** in client-side code
- **Use anon key** for client applications
- **Implement proper RLS policies** for production
- **Validate all user inputs** server-side
- **Use HTTPS** in production
- **Regular security audits** recommended
