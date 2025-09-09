-- Migration to create Supabase Storage buckets for EquiHUB
-- This creates all necessary storage buckets for badges, challenges, stables, profiles, and general images

-- Create badges bucket for challenge and achievement badges
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'badges',
    'badges',
    true,
    '{"image/jpeg","image/jpg","image/png","image/webp","image/gif","image/svg+xml"}',
    5242880  -- 5MB limit
) ON CONFLICT (id) DO NOTHING;

-- Create challenges bucket for challenge icons and images
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'challenges',
    'challenges',
    true,
    '{"image/jpeg","image/jpg","image/png","image/webp","image/gif","image/svg+xml"}',
    5242880  -- 5MB limit
) ON CONFLICT (id) DO NOTHING;

-- Create stables bucket for stable logos and images
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'stables',
    'stables',
    true,
    '{"image/jpeg","image/jpg","image/png","image/webp","image/gif"}',
    10485760  -- 10MB limit for stable images
) ON CONFLICT (id) DO NOTHING;

-- Create profiles bucket for user profile images
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'profiles',
    'profiles',
    true,
    '{"image/jpeg","image/jpg","image/png","image/webp"}',
    5242880  -- 5MB limit
) ON CONFLICT (id) DO NOTHING;

-- Create horses bucket for horse images
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'horses',
    'horses',
    true,
    '{"image/jpeg","image/jpg","image/png","image/webp"}',
    10485760  -- 10MB limit for horse images
) ON CONFLICT (id) DO NOTHING;

-- Create general images bucket for other app images
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'images',
    'images',
    true,
    '{"image/jpeg","image/jpg","image/png","image/webp","image/gif"}',
    10485760  -- 10MB limit
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for public access to badges bucket
CREATE POLICY "Public read access for badges" ON storage.objects
FOR SELECT USING (bucket_id = 'badges');

CREATE POLICY "Authenticated users can upload badges" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'badges' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own badge uploads" ON storage.objects
FOR UPDATE USING (bucket_id = 'badges' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own badge uploads" ON storage.objects
FOR DELETE USING (bucket_id = 'badges' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for challenges bucket
CREATE POLICY "Public read access for challenges" ON storage.objects
FOR SELECT USING (bucket_id = 'challenges');

CREATE POLICY "Authenticated users can upload challenge images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'challenges' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own challenge uploads" ON storage.objects
FOR UPDATE USING (bucket_id = 'challenges' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own challenge uploads" ON storage.objects
FOR DELETE USING (bucket_id = 'challenges' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for stables bucket
CREATE POLICY "Public read access for stables" ON storage.objects
FOR SELECT USING (bucket_id = 'stables');

CREATE POLICY "Authenticated users can upload stable images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'stables' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update stable images" ON storage.objects
FOR UPDATE USING (bucket_id = 'stables' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete stable images" ON storage.objects
FOR DELETE USING (bucket_id = 'stables' AND auth.role() = 'authenticated');

-- Create storage policies for profiles bucket
CREATE POLICY "Public read access for profiles" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');

CREATE POLICY "Users can upload their own profile images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile images" ON storage.objects
FOR UPDATE USING (bucket_id = 'profiles' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own profile images" ON storage.objects
FOR DELETE USING (bucket_id = 'profiles' AND auth.role() = 'authenticated');

-- Create storage policies for horses bucket
CREATE POLICY "Public read access for horses" ON storage.objects
FOR SELECT USING (bucket_id = 'horses');

CREATE POLICY "Users can upload horse images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'horses' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update horse images" ON storage.objects
FOR UPDATE USING (bucket_id = 'horses' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete horse images" ON storage.objects
FOR DELETE USING (bucket_id = 'horses' AND auth.role() = 'authenticated');

-- Create storage policies for general images bucket
CREATE POLICY "Public read access for images" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own images" ON storage.objects
FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Comments for documentation
COMMENT ON POLICY "Public read access for badges" ON storage.objects IS 'Allow public read access to badge images';
COMMENT ON POLICY "Public read access for challenges" ON storage.objects IS 'Allow public read access to challenge images';
COMMENT ON POLICY "Public read access for stables" ON storage.objects IS 'Allow public read access to stable images';
COMMENT ON POLICY "Public read access for profiles" ON storage.objects IS 'Allow public read access to profile images';
COMMENT ON POLICY "Public read access for horses" ON storage.objects IS 'Allow public read access to horse images';
COMMENT ON POLICY "Public read access for images" ON storage.objects IS 'Allow public read access to general images';
