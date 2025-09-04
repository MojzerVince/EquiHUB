-- Add trial_used column to profiles table
ALTER TABLE profiles 
ADD COLUMN trial_used BOOLEAN DEFAULT FALSE;
