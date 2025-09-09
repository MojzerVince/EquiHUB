-- Migration to create stable challenge tables
-- This creates tables for tracking stable challenges and user contributions

-- Create stable_challenges table
CREATE TABLE IF NOT EXISTS public.stable_challenges (
    id TEXT PRIMARY KEY,
    stable_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '🏆',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    target_distance DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    unit TEXT NOT NULL DEFAULT 'km',
    current_progress DECIMAL(10,2) DEFAULT 0.00,
    monthly_reset BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_stable_challenges_stable_id 
        FOREIGN KEY (stable_id) REFERENCES public.stables(id) ON DELETE CASCADE
);

-- Create stable_challenge_participants table for tracking individual contributions
CREATE TABLE IF NOT EXISTS public.stable_challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    contribution DECIMAL(10,2) DEFAULT 0.00,
    last_activity_date TIMESTAMPTZ DEFAULT NOW(),
    join_date TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_stable_challenge_participants_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.stable_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_stable_challenge_participants_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_stable_challenge_participants_challenge_user 
        UNIQUE (challenge_id, user_id)
);

-- Create stable_challenge_rewards table
CREATE TABLE IF NOT EXISTS public.stable_challenge_rewards (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('stable_badge', 'individual_badge', 'points', 'title')),
    threshold DECIMAL(10,2) NOT NULL,
    is_stable_reward BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_stable_challenge_rewards_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.stable_challenges(id) ON DELETE CASCADE
);

-- Create user_stable_challenge_rewards table to track earned rewards
CREATE TABLE IF NOT EXISTS public.user_stable_challenge_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    challenge_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    earned_date TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_user_stable_challenge_rewards_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_stable_challenge_rewards_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.stable_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_stable_challenge_rewards_reward_id 
        FOREIGN KEY (reward_id) REFERENCES public.stable_challenge_rewards(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_stable_challenge_rewards_user_challenge_reward 
        UNIQUE (user_id, challenge_id, reward_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stable_challenges_stable_id ON public.stable_challenges (stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenges_active ON public.stable_challenges (is_active);
CREATE INDEX IF NOT EXISTS idx_stable_challenges_dates ON public.stable_challenges (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_stable_challenge_participants_challenge_id ON public.stable_challenge_participants (challenge_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_participants_user_id ON public.stable_challenge_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_participants_contribution ON public.stable_challenge_participants (contribution DESC);

CREATE INDEX IF NOT EXISTS idx_stable_challenge_rewards_challenge_id ON public.stable_challenge_rewards (challenge_id);

CREATE INDEX IF NOT EXISTS idx_user_stable_challenge_rewards_user_id ON public.user_stable_challenge_rewards (user_id);
CREATE INDEX IF NOT EXISTS idx_user_stable_challenge_rewards_challenge_id ON public.user_stable_challenge_rewards (challenge_id);

-- Add comments for documentation
COMMENT ON TABLE public.stable_challenges IS 'Monthly challenges for stables where all members automatically participate';
COMMENT ON TABLE public.stable_challenge_participants IS 'Individual user contributions to stable challenges';
COMMENT ON TABLE public.stable_challenge_rewards IS 'Rewards available for stable challenges';
COMMENT ON TABLE public.user_stable_challenge_rewards IS 'Tracking of rewards earned by users in stable challenges';

-- Create trigger to update stable challenge progress when participant contribution changes
CREATE OR REPLACE FUNCTION update_stable_challenge_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the current_progress in stable_challenges table
    UPDATE public.stable_challenges 
    SET current_progress = (
        SELECT COALESCE(SUM(contribution), 0)
        FROM public.stable_challenge_participants 
        WHERE challenge_id = COALESCE(NEW.challenge_id, OLD.challenge_id)
        AND is_active = TRUE
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.challenge_id, OLD.challenge_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic progress updates
DROP TRIGGER IF EXISTS trigger_update_stable_challenge_progress ON public.stable_challenge_participants;
CREATE TRIGGER trigger_update_stable_challenge_progress
    AFTER INSERT OR UPDATE OF contribution OR DELETE
    ON public.stable_challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_stable_challenge_progress();

-- Disable RLS for now (can be enabled later with proper policies)
ALTER TABLE public.stable_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_challenge_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_challenge_rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stable_challenge_rewards DISABLE ROW LEVEL SECURITY;
