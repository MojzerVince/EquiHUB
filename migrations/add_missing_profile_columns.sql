-- Migration to add missing columns to profiles table
-- Run this migration in your Supabase SQL editor

-- Add the stable_ranch column to store stable/ranch name (if it doesn't exist)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stable_ranch TEXT NULL;

-- Add the experience column to store years of riding experience (if it doesn't exist)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;

-- Add the is_pro_member column to store membership status (if it doesn't exist)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_pro_member BOOLEAN DEFAULT FALSE;

-- Add comments to describe the columns
COMMENT ON COLUMN public.profiles.stable_ranch IS 'Name of the stable or ranch where the user rides (optional)';
COMMENT ON COLUMN public.profiles.experience IS 'Years of riding experience';
COMMENT ON COLUMN public.profiles.is_pro_member IS 'Whether the user has a PRO membership';

-- Create indexes on the new columns for better search performance
CREATE INDEX IF NOT EXISTS idx_profiles_stable_ranch 
ON public.profiles (stable_ranch) 
WHERE stable_ranch IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_experience 
ON public.profiles (experience);

CREATE INDEX IF NOT EXISTS idx_profiles_is_pro_member 
ON public.profiles (is_pro_member);

-- Optional: Update existing profiles to have default values instead of NULL (if desired)
-- This is commented out - uncomment if you want to set default values for existing records
-- UPDATE public.profiles 
-- SET stable_ranch = '', experience = 0, is_pro_member = FALSE
-- WHERE stable_ranch IS NULL OR experience IS NULL OR is_pro_member IS NULL;
