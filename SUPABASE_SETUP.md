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
const supabaseUrl = 'YOUR_PROJECT_URL_HERE'
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE'
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
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create policy for storage bucket
CREATE POLICY "Allow public access to profile images" ON storage.objects
  FOR ALL USING (bucket_id = 'profile-images');
```

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

- **CORS Issues**: Make sure your app URL is added to Supabase project settings
- **Storage Issues**: Check that storage bucket policies are correctly set
- **Network Issues**: Ensure your device/emulator has internet access
- **API Errors**: Check Supabase dashboard logs for detailed error messages
