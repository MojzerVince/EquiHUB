# Supabase Setup Instructions for EquiHUB

## 1. Install Supabase Package

```bash
npm install @supabase/supabase-js
```

## 2. Create Supabase Project

1. Go to https://supabase.com
2. Create a new account or sign in
3. Create a new project
4. Wait for the project to be ready

## 3. Get Your Credentials

1. Go to Project Settings > API
2. Copy your project URL and anon public key
3. Update `lib/supabase.ts` with your credentials:

```typescript
const supabaseUrl = "YOUR_PROJECT_URL_HERE";
const supabaseAnonKey = "YOUR_ANON_KEY_HERE";
```

## 4. Create Database Tables

Go to SQL Editor in your Supabase dashboard and run these commands:

### Create Profiles Table

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  description TEXT,
  experience INTEGER DEFAULT 0,
  is_pro_member BOOLEAN DEFAULT FALSE,
  stable_ranch TEXT NULL,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add column comments
COMMENT ON COLUMN profiles.experience IS 'Years of riding experience';
COMMENT ON COLUMN profiles.is_pro_member IS 'Whether the user has a PRO membership';
COMMENT ON COLUMN profiles.stable_ranch IS 'Name of the stable or ranch where the user rides (optional)';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_experience ON profiles (experience);
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro_member ON profiles (is_pro_member);
CREATE INDEX IF NOT EXISTS idx_profiles_stable_ranch ON profiles (stable_ranch) WHERE stable_ranch IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for demo)
-- In production, you'd want more restrictive policies
CREATE POLICY "Allow all operations on profiles" ON profiles
  FOR ALL USING (true);
```

### Create Storage Bucket for Images

```sql
-- Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true);

-- Create policies for storage bucket (IMPORTANT!)
CREATE POLICY "Allow public access to profile images" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');
CREATE POLICY "Allow public upload to profile images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-images');
CREATE POLICY "Allow public update to profile images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'profile-images');
```

**IMPORTANT**: If you get storage errors, make sure:

1. The bucket `profile-images` exists and is **public**
2. The policies above are created
3. See `STORAGE_SETUP.md` for detailed troubleshooting

## 5. Test the Integration

1. Make sure you've installed the package: `npm install @supabase/supabase-js`
2. Update the credentials in `lib/supabase.ts`
3. Run your app and try editing the profile
4. Check your Supabase dashboard to see the data being saved

## 6. Features Now Available

✅ **Profile Data Persistence**: Name, age, description saved to database
✅ **Image Upload**: Profile pictures uploaded to Supabase Storage
✅ **Loading States**: Visual feedback during API calls
✅ **Error Handling**: User-friendly error messages
✅ **Auto-load**: Profile data loads automatically on app start

## 7. Next Steps (Optional)

- **Authentication**: Add user login/signup
- **Real-time Updates**: Use Supabase real-time subscriptions
- **Gallery**: Implement photo gallery functionality
- **Offline Support**: Add local storage fallback
- **Image Optimization**: Compress images before upload

## 8. Troubleshooting

- **UUID Error**: Make sure the user ID is a valid UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000")
- **CORS Issues**: Make sure your app URL is added to Supabase project settings
- **Storage Issues**: Check that storage bucket policies are correctly set
- **Network Issues**: Ensure your device/emulator has internet access
- **API Errors**: Check Supabase dashboard logs for detailed error messages

## 9. Important Notes

- **User ID Format**: The app uses a hardcoded UUID for demo purposes. In production, this should come from authentication
- **Profile Creation**: The app automatically creates a profile if one doesn't exist for the user ID
- **Data Persistence**: All profile changes are saved to the Supabase database and will persist between app sessions
