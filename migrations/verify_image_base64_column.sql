-- Verification script for image_base64 column
-- Run this in your Supabase SQL editor to verify the column exists

-- Check if the image_base64 column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'community_posts' 
  AND column_name = 'image_base64';

-- If the above query returns a row, the column exists and you're good to go!
-- If it returns no rows, the column doesn't exist and you need to add it.

-- Also check the current structure of the community_posts table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'community_posts' 
ORDER BY ordinal_position;
