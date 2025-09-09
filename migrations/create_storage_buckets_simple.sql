-- SIMPLIFIED STORAGE SETUP - Run this if you get permission errors
-- This version only creates the buckets without advanced policies

-- Create storage buckets (these should work with standard permissions)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('badges', 'badges', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('challenges', 'challenges', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('stables', 'stables', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('profiles', 'profiles', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('horses', 'horses', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('images', 'images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Basic RLS policies for authenticated users
-- These are simpler and should work with most permission levels

-- Badges bucket policies
CREATE POLICY "Authenticated users can upload badges" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'badges');

CREATE POLICY "Anyone can view badges" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'badges');

-- Challenges bucket policies  
CREATE POLICY "Authenticated users can upload challenges" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'challenges');

CREATE POLICY "Anyone can view challenges" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'challenges');

-- Stables bucket policies
CREATE POLICY "Authenticated users can upload stable images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stables');

CREATE POLICY "Anyone can view stable images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'stables');

-- Profiles bucket policies (private)
CREATE POLICY "Users can upload own profile images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own profile images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Horses bucket policies
CREATE POLICY "Authenticated users can upload horse images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'horses');

CREATE POLICY "Anyone can view horse images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'horses');

-- General images bucket policies
CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "Anyone can view images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'images');
