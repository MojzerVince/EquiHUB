-- Migration to add image_base64 column to community_posts table
-- Run this migration in your Supabase SQL editor

-- Add the image_base64 column to store base64 encoded images (if it doesn't exist)
ALTER TABLE public.community_posts 
ADD COLUMN IF NOT EXISTS image_base64 TEXT NULL;

-- Add a comment to describe the column
COMMENT ON COLUMN public.community_posts.image_base64 IS 'Base64 encoded image data for the post';

-- Optional: Add a check constraint to ensure image_base64 is valid base64 (if needed)
-- This is commented out as it might be too restrictive depending on your use case
-- ALTER TABLE public.community_posts 
-- ADD CONSTRAINT check_image_base64_format 
-- CHECK (image_base64 IS NULL OR image_base64 ~ '^[A-Za-z0-9+/]*={0,2}$');

-- Create an index on the new column if you plan to query by it
-- CREATE INDEX IF NOT EXISTS idx_community_posts_has_base64 
-- ON public.community_posts (image_base64) 
-- WHERE image_base64 IS NOT NULL;
