-- Add new columns to sessions table for rider/horse performance, ground type, and notes
-- Migration: Add session feedback fields
-- Date: 2025-01-16

-- Add rider_performance column (1-10 scale)
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS rider_performance integer CHECK (rider_performance >= 1 AND rider_performance <= 10);

-- Add horse_performance column (1-10 scale)
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS horse_performance integer CHECK (horse_performance >= 1 AND rider_performance <= 10);

-- Add ground_type column (Soft, Medium, Hard, Mixed)
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS ground_type text CHECK (ground_type IN ('Soft', 'Medium', 'Hard', 'Mixed'));

-- Add notes column for rider notes
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS notes text;

-- Add comments to document the new columns
COMMENT ON COLUMN public.sessions.rider_performance IS 'Rider self-assessment rating from 1-10';
COMMENT ON COLUMN public.sessions.horse_performance IS 'Horse performance rating from 1-10';
COMMENT ON COLUMN public.sessions.ground_type IS 'Type of ground/surface: Soft, Medium, Hard, or Mixed';
COMMENT ON COLUMN public.sessions.notes IS 'Rider notes for future reference';
