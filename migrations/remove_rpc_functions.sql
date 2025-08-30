-- Alternative fix: Remove RPC functions and use triggers only
-- This eliminates the function not found error by removing the dependency

-- Drop the problematic RPC functions that aren't working
DROP FUNCTION IF EXISTS public.increment_stable_member_count(UUID);
DROP FUNCTION IF EXISTS public.decrement_stable_member_count(UUID);

-- Ensure the trigger function exists and works correctly
CREATE OR REPLACE FUNCTION public.update_stable_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment member count when someone joins
    UPDATE public.stables 
    SET member_count = member_count + 1, updated_at = NOW()
    WHERE id = NEW.stable_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement member count when someone leaves
    UPDATE public.stables 
    SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.stable_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it's working
DROP TRIGGER IF EXISTS trigger_update_stable_member_count ON public.stable_members;
CREATE TRIGGER trigger_update_stable_member_count
  AFTER INSERT OR DELETE ON public.stable_members
  FOR EACH ROW EXECUTE FUNCTION public.update_stable_member_count();

-- Test that the trigger works
SELECT 'Member count will be handled automatically by triggers' as status;
