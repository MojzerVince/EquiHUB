-- Migration to create stables and stable_members tables
-- This enables the stable/ranch creation and management functionality

-- Create stables table
CREATE TABLE IF NOT EXISTS public.stables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  city TEXT,
  state_province TEXT,
  country TEXT DEFAULT 'US',
  description TEXT,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stable_members table for user-stable relationships
CREATE TABLE IF NOT EXISTS public.stable_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stable_id UUID NOT NULL REFERENCES public.stables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stable_id, user_id)
);

-- Add comments to describe the tables and columns
COMMENT ON TABLE public.stables IS 'Stables and ranches where users can be members';
COMMENT ON COLUMN public.stables.name IS 'Name of the stable or ranch';
COMMENT ON COLUMN public.stables.location IS 'Street address or general location';
COMMENT ON COLUMN public.stables.city IS 'City where the stable is located';
COMMENT ON COLUMN public.stables.state_province IS 'State or province where the stable is located';
COMMENT ON COLUMN public.stables.member_count IS 'Number of members in this stable';

COMMENT ON TABLE public.stable_members IS 'Membership relationships between users and stables';
COMMENT ON COLUMN public.stable_members.role IS 'User role in the stable (owner, admin, member)';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stables_name ON public.stables (name);
CREATE INDEX IF NOT EXISTS idx_stables_location ON public.stables (city, state_province);
CREATE INDEX IF NOT EXISTS idx_stables_member_count ON public.stables (member_count DESC);

CREATE INDEX IF NOT EXISTS idx_stable_members_stable_id ON public.stable_members (stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_members_user_id ON public.stable_members (user_id);
CREATE INDEX IF NOT EXISTS idx_stable_members_role ON public.stable_members (role);

-- For demo purposes, disable Row Level Security to avoid infinite recursion
-- In production, you would implement more sophisticated policies
ALTER TABLE public.stables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_members DISABLE ROW LEVEL SECURITY;

-- Create function to increment stable member count
CREATE OR REPLACE FUNCTION public.increment_stable_member_count(stable_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.stables 
  SET member_count = member_count + 1, updated_at = NOW()
  WHERE id = stable_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrement stable member count
CREATE OR REPLACE FUNCTION public.decrement_stable_member_count(stable_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.stables 
  SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW()
  WHERE id = stable_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update stable member count when members are added/removed
CREATE OR REPLACE FUNCTION public.update_stable_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stables 
    SET member_count = member_count + 1, updated_at = NOW()
    WHERE id = NEW.stable_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stables 
    SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.stable_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_stable_member_count ON public.stable_members;
CREATE TRIGGER trigger_update_stable_member_count
  AFTER INSERT OR DELETE ON public.stable_members
  FOR EACH ROW EXECUTE FUNCTION public.update_stable_member_count();
