-- Migration to add verification status to stables
-- This adds the ability to mark stables as "verified" with a badge

-- Add is_verified column to stables table
ALTER TABLE public.stables 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add comment to describe the column
COMMENT ON COLUMN public.stables.is_verified IS 'Whether the stable has been verified by administrators';

-- Create index for better performance when filtering by verification status
CREATE INDEX IF NOT EXISTS idx_stables_is_verified ON public.stables (is_verified);

-- Create composite index for verified stables with member count for optimal sorting
CREATE INDEX IF NOT EXISTS idx_stables_verified_member_count ON public.stables (is_verified DESC, member_count DESC);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'stables'
  AND column_name = 'is_verified';

-- Optional: Mark some example stables as verified for testing
-- Uncomment the following lines if you want to add some verified stables for demonstration

/*
-- You can manually mark specific stables as verified
UPDATE public.stables 
SET is_verified = TRUE 
WHERE name IN ('Example Verified Stable', 'Premium Horse Ranch')
  AND member_count > 5;

-- Or mark the top 3 stables by member count as verified for demo
UPDATE public.stables 
SET is_verified = TRUE 
WHERE id IN (
  SELECT id FROM public.stables 
  ORDER BY member_count DESC 
  LIMIT 3
);
*/

SELECT 'Verification system added successfully' as status;
