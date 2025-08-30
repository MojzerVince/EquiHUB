-- EquiHUB Stables/Ranch Database Setup
-- This script creates the database schema for stables/ranches that users can join or create

-- Create stables table
CREATE TABLE IF NOT EXISTS public.stables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    country VARCHAR(100),
    state_province VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    cover_image_url TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    member_count INTEGER DEFAULT 0,
    max_members INTEGER DEFAULT 100,
    is_public BOOLEAN DEFAULT true, -- Public stables can be found and joined, private require invitation
    join_code VARCHAR(10) UNIQUE, -- Optional join code for easy joining
    specialties TEXT[], -- Array of specialties like ["Dressage", "Jumping", "Trail Riding"]
    facilities TEXT[], -- Array of facilities like ["Indoor Arena", "Outdoor Arena", "Trails"]
    
    -- Contact and business info
    business_hours JSONB, -- Store business hours as JSON
    pricing_info TEXT,
    social_media JSONB, -- Store social media links as JSON
    
    -- Search and filtering
    search_vector tsvector, -- Full-text search vector
    
    CONSTRAINT valid_max_members CHECK (max_members > 0 AND max_members <= 1000),
    CONSTRAINT valid_member_count CHECK (member_count >= 0 AND member_count <= max_members)
);

-- Create stable_members table for user-stable relationships
CREATE TABLE IF NOT EXISTS public.stable_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stable_id UUID REFERENCES public.stables(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) DEFAULT 'member' NOT NULL, -- 'owner', 'admin', 'instructor', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    notes TEXT, -- Admin notes about the member
    
    -- Member-specific info
    member_number VARCHAR(20), -- Optional member number
    emergency_contact JSONB, -- Emergency contact info
    
    UNIQUE(stable_id, user_id),
    
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'instructor', 'member'))
);

-- Create stable_invitations table for managing invitations
CREATE TABLE IF NOT EXISTS public.stable_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stable_id UUID REFERENCES public.stables(id) ON DELETE CASCADE NOT NULL,
    inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255), -- For inviting users who don't have accounts yet
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- 'pending', 'accepted', 'declined', 'expired'
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    CONSTRAINT valid_invitation_role CHECK (role IN ('admin', 'instructor', 'member')),
    CONSTRAINT valid_invitee CHECK (
        (invitee_id IS NOT NULL AND invitee_email IS NULL) OR
        (invitee_id IS NULL AND invitee_email IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stables_owner_id ON public.stables(owner_id);
CREATE INDEX IF NOT EXISTS idx_stables_location ON public.stables(country, state_province, city);
CREATE INDEX IF NOT EXISTS idx_stables_active ON public.stables(is_active);
CREATE INDEX IF NOT EXISTS idx_stables_public ON public.stables(is_public);
CREATE INDEX IF NOT EXISTS idx_stables_search ON public.stables USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_stables_join_code ON public.stables(join_code) WHERE join_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stable_members_stable_id ON public.stable_members(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_members_user_id ON public.stable_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stable_members_role ON public.stable_members(role);
CREATE INDEX IF NOT EXISTS idx_stable_members_active ON public.stable_members(is_active);

CREATE INDEX IF NOT EXISTS idx_stable_invitations_stable_id ON public.stable_invitations(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_invitations_invitee_id ON public.stable_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_stable_invitations_status ON public.stable_invitations(status);
CREATE INDEX IF NOT EXISTS idx_stable_invitations_expires_at ON public.stable_invitations(expires_at);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_stable_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.name, '') || ' ' ||
        COALESCE(NEW.description, '') || ' ' ||
        COALESCE(NEW.location, '') || ' ' ||
        COALESCE(NEW.city, '') || ' ' ||
        COALESCE(array_to_string(NEW.specialties, ' '), '') || ' ' ||
        COALESCE(array_to_string(NEW.facilities, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector
CREATE TRIGGER update_stable_search_vector_trigger
    BEFORE INSERT OR UPDATE ON public.stables
    FOR EACH ROW
    EXECUTE FUNCTION update_stable_search_vector();

-- Create function to update stable member count
CREATE OR REPLACE FUNCTION update_stable_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.stables 
        SET member_count = member_count + 1,
            updated_at = NOW()
        WHERE id = NEW.stable_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.stables 
        SET member_count = member_count - 1,
            updated_at = NOW()
        WHERE id = OLD.stable_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle active status changes
        IF OLD.is_active != NEW.is_active THEN
            IF NEW.is_active THEN
                UPDATE public.stables 
                SET member_count = member_count + 1,
                    updated_at = NOW()
                WHERE id = NEW.stable_id;
            ELSE
                UPDATE public.stables 
                SET member_count = member_count - 1,
                    updated_at = NOW()
                WHERE id = NEW.stable_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for member count
CREATE TRIGGER update_stable_member_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.stable_members
    FOR EACH ROW
    EXECUTE FUNCTION update_stable_member_count();

-- Create function to generate join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Generate a 6-character random alphanumeric code
        code := UPPER(
            SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 3) ||
            SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 3)
        );
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM public.stables WHERE join_code = code) INTO exists_check;
        
        -- If code doesn't exist, we can use it
        IF NOT exists_check THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add stable_id column to profiles table to track user's primary stable
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stable_id UUID REFERENCES public.stables(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_profiles_stable_id ON public.profiles(stable_id);

-- Create RLS policies for stables

-- Enable RLS
ALTER TABLE public.stables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_invitations ENABLE ROW LEVEL SECURITY;

-- Stables policies
CREATE POLICY "Stables are viewable by everyone" ON public.stables
    FOR SELECT USING (true);

CREATE POLICY "Users can create stables" ON public.stables
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stable owners can update their stables" ON public.stables
    FOR UPDATE USING (
        auth.uid() = owner_id OR 
        EXISTS (
            SELECT 1 FROM public.stable_members 
            WHERE stable_id = id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

CREATE POLICY "Stable owners can delete their stables" ON public.stables
    FOR DELETE USING (auth.uid() = owner_id);

-- Stable members policies
CREATE POLICY "Stable members are viewable by stable members" ON public.stable_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.stable_members sm 
            WHERE sm.stable_id = stable_members.stable_id 
            AND sm.user_id = auth.uid() 
            AND sm.is_active = true
        )
    );

CREATE POLICY "Users can join stables" ON public.stable_members
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.stable_members 
                WHERE stable_id = stable_members.stable_id 
                AND user_id = auth.uid() 
                AND role IN ('owner', 'admin')
                AND is_active = true
            )
        )
    );

CREATE POLICY "Users can update their own membership or admins can update" ON public.stable_members
    FOR UPDATE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.stable_members 
            WHERE stable_id = stable_members.stable_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

CREATE POLICY "Users can leave stables or admins can remove members" ON public.stable_members
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.stable_members 
            WHERE stable_id = stable_members.stable_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Stable invitations policies
CREATE POLICY "Users can view their own invitations" ON public.stable_invitations
    FOR SELECT USING (
        invitee_id = auth.uid() OR
        inviter_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.stable_members 
            WHERE stable_id = stable_invitations.stable_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

CREATE POLICY "Stable admins can create invitations" ON public.stable_invitations
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.stable_members 
            WHERE stable_id = stable_invitations.stable_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

CREATE POLICY "Users can respond to their invitations" ON public.stable_invitations
    FOR UPDATE USING (
        invitee_id = auth.uid() OR
        inviter_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.stable_members 
            WHERE stable_id = stable_invitations.stable_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Create some sample data for testing
INSERT INTO public.stables (
    name, 
    description, 
    location, 
    country, 
    state_province, 
    city,
    is_public,
    specialties,
    facilities,
    join_code
) VALUES 
(
    'Sunset Ridge Stables',
    'A premier equestrian facility offering training in dressage, jumping, and trail riding. Perfect for riders of all levels.',
    'California, USA',
    'USA',
    'California',
    'Los Angeles',
    true,
    ARRAY['Dressage', 'Show Jumping', 'Trail Riding'],
    ARRAY['Indoor Arena', 'Outdoor Arena', 'Trails', 'Boarding'],
    'SUNSET'
),
(
    'Green Valley Ranch',
    'Family-friendly ranch specializing in western riding and horse care education.',
    'Texas, USA',
    'USA',
    'Texas',
    'Austin',
    true,
    ARRAY['Western Riding', 'Ranch Work', 'Beginner Lessons'],
    ARRAY['Outdoor Arena', 'Trails', 'Pastures', 'Training Round Pen'],
    'VALLEY'
),
(
    'European Dressage Center',
    'Professional dressage training facility with Olympic-level instruction.',
    'Bavaria, Germany',
    'Germany',
    'Bavaria',
    'Munich',
    true,
    ARRAY['Dressage', 'Classical Training'],
    ARRAY['Indoor Arena', 'Mirrors', 'Viewing Gallery'],
    'EUROPA'
);

-- Create function to handle stable joining during user registration
CREATE OR REPLACE FUNCTION handle_user_registration_stable_join()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user metadata includes stable information
    IF NEW.raw_user_meta_data ->> 'stable_id' IS NOT NULL THEN
        -- Join by stable ID
        INSERT INTO public.stable_members (stable_id, user_id, role, is_active)
        VALUES (
            (NEW.raw_user_meta_data ->> 'stable_id')::UUID,
            NEW.id,
            'member',
            true
        )
        ON CONFLICT (stable_id, user_id) DO UPDATE SET
            is_active = true,
            joined_at = NOW();
            
        -- Update user's profile with stable_id
        UPDATE public.profiles 
        SET stable_id = (NEW.raw_user_meta_data ->> 'stable_id')::UUID
        WHERE id = NEW.id;
        
    ELSIF NEW.raw_user_meta_data ->> 'stable_join_code' IS NOT NULL THEN
        -- Join by join code
        INSERT INTO public.stable_members (stable_id, user_id, role, is_active)
        SELECT s.id, NEW.id, 'member', true
        FROM public.stables s
        WHERE s.join_code = UPPER(NEW.raw_user_meta_data ->> 'stable_join_code')
        AND s.is_active = true
        AND s.is_public = true
        ON CONFLICT (stable_id, user_id) DO UPDATE SET
            is_active = true,
            joined_at = NOW();
            
        -- Update user's profile with stable_id
        UPDATE public.profiles 
        SET stable_id = (
            SELECT s.id 
            FROM public.stables s
            WHERE s.join_code = UPPER(NEW.raw_user_meta_data ->> 'stable_join_code')
            AND s.is_active = true
            AND s.is_public = true
            LIMIT 1
        )
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for handling stable joining during registration
-- This trigger should run after the profile is created
CREATE OR REPLACE TRIGGER handle_user_registration_stable_join_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_registration_stable_join();

-- Insert default stable membership for existing users (optional)
-- This can be run after the schema is created to give existing users a default stable option

COMMIT;
