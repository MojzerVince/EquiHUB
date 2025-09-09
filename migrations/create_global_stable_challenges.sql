-- Migration to create global stable challenge system
-- This transforms stable challenges from individual stable competitions to global competitions

-- First, backup existing data if needed
-- CREATE TABLE IF NOT EXISTS stable_challenges_backup AS SELECT * FROM stable_challenges;

-- Create global_challenges table for challenges that all stables compete in
CREATE TABLE IF NOT EXISTS public.global_challenges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '🏆',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    target_distance DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    unit TEXT NOT NULL DEFAULT 'km',
    challenge_type TEXT NOT NULL DEFAULT 'monthly' CHECK (challenge_type IN ('weekly', 'monthly', 'special')),
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
    max_participants INTEGER DEFAULT NULL, -- NULL means unlimited stables can participate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stable_challenge_progress table to track each stable's progress in global challenges
CREATE TABLE IF NOT EXISTS public.stable_challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL,
    stable_id UUID NOT NULL,
    stable_name TEXT NOT NULL, -- Denormalized for performance
    progress_value DECIMAL(10,2) DEFAULT 0.00,
    member_count INTEGER DEFAULT 0, -- Track how many members contributed
    average_contribution DECIMAL(10,2) DEFAULT 0.00, -- Average per member
    completed_at TIMESTAMPTZ DEFAULT NULL,
    rank INTEGER DEFAULT NULL, -- Auto-calculated ranking
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_stable_challenge_progress_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.global_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_stable_challenge_progress_stable_id 
        FOREIGN KEY (stable_id) REFERENCES public.stables(id) ON DELETE CASCADE,
    CONSTRAINT uq_stable_challenge_progress_challenge_stable 
        UNIQUE (challenge_id, stable_id)
);

-- Create individual_stable_contributions table to track individual user contributions
CREATE TABLE IF NOT EXISTS public.individual_stable_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL,
    stable_id UUID NOT NULL,
    user_id UUID NOT NULL,
    contribution DECIMAL(10,2) DEFAULT 0.00,
    session_count INTEGER DEFAULT 0, -- Number of sessions contributed
    last_activity_date TIMESTAMPTZ DEFAULT NOW(),
    join_date TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_individual_contributions_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.global_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_individual_contributions_stable_id 
        FOREIGN KEY (stable_id) REFERENCES public.stables(id) ON DELETE CASCADE,
    CONSTRAINT fk_individual_contributions_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_individual_contributions_challenge_stable_user 
        UNIQUE (challenge_id, stable_id, user_id)
);

-- Create global_challenge_rewards table
CREATE TABLE IF NOT EXISTS public.global_challenge_rewards (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('stable_badge', 'individual_badge', 'points', 'title', 'leaderboard_position')),
    threshold DECIMAL(10,2) NOT NULL,
    rank_requirement INTEGER DEFAULT NULL, -- For position-based rewards (1st, 2nd, 3rd place)
    is_stable_reward BOOLEAN DEFAULT FALSE, -- true for stable-wide rewards, false for individual
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_global_challenge_rewards_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.global_challenges(id) ON DELETE CASCADE
);

-- Create user_global_challenge_rewards table to track earned rewards
CREATE TABLE IF NOT EXISTS public.user_global_challenge_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    stable_id UUID NOT NULL,
    challenge_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    earned_date TIMESTAMPTZ DEFAULT NOW(),
    final_rank INTEGER DEFAULT NULL, -- What rank the stable achieved
    final_progress DECIMAL(10,2) DEFAULT NULL, -- What progress the stable achieved
    
    CONSTRAINT fk_user_global_challenge_rewards_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_global_challenge_rewards_stable_id 
        FOREIGN KEY (stable_id) REFERENCES public.stables(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_global_challenge_rewards_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.global_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_global_challenge_rewards_reward_id 
        FOREIGN KEY (reward_id) REFERENCES public.global_challenge_rewards(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_global_challenge_rewards_user_challenge_reward 
        UNIQUE (user_id, challenge_id, reward_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_challenges_active ON public.global_challenges (is_active);
CREATE INDEX IF NOT EXISTS idx_global_challenges_dates ON public.global_challenges (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_global_challenges_type ON public.global_challenges (challenge_type);

CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_challenge_id ON public.stable_challenge_progress (challenge_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_stable_id ON public.stable_challenge_progress (stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_rank ON public.stable_challenge_progress (challenge_id, rank);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_value ON public.stable_challenge_progress (challenge_id, progress_value DESC);

CREATE INDEX IF NOT EXISTS idx_individual_contributions_challenge_id ON public.individual_stable_contributions (challenge_id);
CREATE INDEX IF NOT EXISTS idx_individual_contributions_stable_id ON public.individual_stable_contributions (stable_id);
CREATE INDEX IF NOT EXISTS idx_individual_contributions_user_id ON public.individual_stable_contributions (user_id);
CREATE INDEX IF NOT EXISTS idx_individual_contributions_contribution ON public.individual_stable_contributions (stable_id, contribution DESC);

CREATE INDEX IF NOT EXISTS idx_global_challenge_rewards_challenge_id ON public.global_challenge_rewards (challenge_id);

CREATE INDEX IF NOT EXISTS idx_user_global_challenge_rewards_user_id ON public.user_global_challenge_rewards (user_id);
CREATE INDEX IF NOT EXISTS idx_user_global_challenge_rewards_challenge_id ON public.user_global_challenge_rewards (challenge_id);
CREATE INDEX IF NOT EXISTS idx_user_global_challenge_rewards_stable_id ON public.user_global_challenge_rewards (stable_id);

-- Function to update stable progress when individual contributions change
CREATE OR REPLACE FUNCTION update_stable_progress_from_contributions()
RETURNS TRIGGER AS $$
DECLARE
    stable_total DECIMAL(10,2);
    active_members INTEGER;
    avg_contribution DECIMAL(10,2);
BEGIN
    -- Calculate total progress for the stable
    SELECT 
        COALESCE(SUM(contribution), 0),
        COUNT(DISTINCT user_id)
    INTO stable_total, active_members
    FROM public.individual_stable_contributions 
    WHERE challenge_id = COALESCE(NEW.challenge_id, OLD.challenge_id)
    AND stable_id = COALESCE(NEW.stable_id, OLD.stable_id)
    AND is_active = TRUE;
    
    -- Calculate average contribution per member
    avg_contribution := CASE 
        WHEN active_members > 0 THEN stable_total / active_members 
        ELSE 0 
    END;
    
    -- Update or insert stable progress
    INSERT INTO public.stable_challenge_progress (
        challenge_id,
        stable_id,
        stable_name,
        progress_value,
        member_count,
        average_contribution,
        last_updated
    )
    SELECT 
        COALESCE(NEW.challenge_id, OLD.challenge_id),
        COALESCE(NEW.stable_id, OLD.stable_id),
        s.name,
        stable_total,
        active_members,
        avg_contribution,
        NOW()
    FROM public.stables s 
    WHERE s.id = COALESCE(NEW.stable_id, OLD.stable_id)
    ON CONFLICT (challenge_id, stable_id) 
    DO UPDATE SET
        progress_value = EXCLUDED.progress_value,
        member_count = EXCLUDED.member_count,
        average_contribution = EXCLUDED.average_contribution,
        last_updated = EXCLUDED.last_updated,
        completed_at = CASE 
            WHEN EXCLUDED.progress_value >= (
                SELECT target_distance 
                FROM public.global_challenges 
                WHERE id = EXCLUDED.challenge_id
            ) AND stable_challenge_progress.completed_at IS NULL 
            THEN NOW() 
            ELSE stable_challenge_progress.completed_at 
        END;
    
    -- Update rankings for this challenge
    PERFORM update_global_challenge_rankings(COALESCE(NEW.challenge_id, OLD.challenge_id));
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update rankings across all stables for a challenge
CREATE OR REPLACE FUNCTION update_global_challenge_rankings(challenge_uuid TEXT)
RETURNS void AS $$
BEGIN
    WITH ranked_progress AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                ORDER BY 
                    progress_value DESC,
                    average_contribution DESC,
                    last_updated ASC
            ) as new_rank
        FROM public.stable_challenge_progress 
        WHERE challenge_id = challenge_uuid
    )
    UPDATE public.stable_challenge_progress 
    SET rank = ranked_progress.new_rank
    FROM ranked_progress 
    WHERE stable_challenge_progress.id = ranked_progress.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic progress and ranking updates
DROP TRIGGER IF EXISTS trigger_update_stable_progress ON public.individual_stable_contributions;
CREATE TRIGGER trigger_update_stable_progress
    AFTER INSERT OR UPDATE OF contribution OR DELETE
    ON public.individual_stable_contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_stable_progress_from_contributions();

-- Function to create monthly global challenge
CREATE OR REPLACE FUNCTION create_monthly_global_challenge()
RETURNS TEXT AS $$
DECLARE
    challenge_id TEXT;
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    -- Calculate this month's dates
    start_date := date_trunc('month', NOW());
    end_date := (date_trunc('month', NOW()) + interval '1 month' - interval '1 second');
    
    -- Generate challenge ID
    challenge_id := 'global_monthly_' || to_char(start_date, 'YYYY_MM');
    
    -- Check if challenge already exists
    IF EXISTS (SELECT 1 FROM public.global_challenges WHERE id = challenge_id) THEN
        RETURN challenge_id;
    END IF;
    
    -- Create the challenge
    INSERT INTO public.global_challenges (
        id,
        title,
        description,
        icon,
        start_date,
        end_date,
        is_active,
        target_distance,
        unit,
        challenge_type,
        difficulty
    ) VALUES (
        challenge_id,
        'Global Stable Championship - ' || to_char(start_date, 'Month YYYY'),
        'All stables compete to see who can achieve the highest total distance this month. Work together with your stable members to climb the global leaderboard!',
        '🌍',
        start_date,
        end_date,
        TRUE,
        1000.00, -- 1000km target for global challenges
        'km',
        'monthly',
        'hard'
    );
    
    -- Create default rewards
    INSERT INTO public.global_challenge_rewards (id, challenge_id, name, description, icon, type, threshold, rank_requirement, is_stable_reward) VALUES
    (challenge_id || '_champion', challenge_id, 'Global Champion', 'Your stable claimed 1st place in the global championship!', '🏆', 'leaderboard_position', 0, 1, TRUE),
    (challenge_id || '_silver', challenge_id, 'Global Runner-up', 'Your stable achieved 2nd place globally!', '🥈', 'leaderboard_position', 0, 2, TRUE),
    (challenge_id || '_bronze', challenge_id, 'Global Third Place', 'Your stable earned 3rd place globally!', '🥉', 'leaderboard_position', 0, 3, TRUE),
    (challenge_id || '_top10', challenge_id, 'Top 10 Global Stable', 'Your stable finished in the top 10 globally!', '🔟', 'leaderboard_position', 0, 10, TRUE),
    (challenge_id || '_participant', challenge_id, 'Global Participant', 'Participated in the global stable championship', '🌍', 'stable_badge', 50, NULL, FALSE),
    (challenge_id || '_contributor', challenge_id, 'Dedicated Contributor', 'Made significant contribution to your stable', '💪', 'individual_badge', 100, NULL, FALSE),
    (challenge_id || '_champion_individual', challenge_id, 'Championship Warrior', 'Outstanding performance in global championship', '⚔️', 'individual_badge', 200, NULL, FALSE);
    
    RETURN challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-enroll all stables in new global challenges
CREATE OR REPLACE FUNCTION auto_enroll_stables_in_global_challenge(challenge_uuid TEXT)
RETURNS void AS $$
BEGIN
    -- Insert all active stables into the challenge with 0 progress
    INSERT INTO public.stable_challenge_progress (
        challenge_id,
        stable_id,
        stable_name,
        progress_value,
        member_count,
        average_contribution
    )
    SELECT 
        challenge_uuid,
        s.id,
        s.name,
        0.00,
        0,
        0.00
    FROM public.stables s
    WHERE s.is_active = TRUE
    ON CONFLICT (challenge_id, stable_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.global_challenges IS 'Global challenges where all stables compete against each other';
COMMENT ON TABLE public.stable_challenge_progress IS 'Each stable''s progress in global challenges with rankings';
COMMENT ON TABLE public.individual_stable_contributions IS 'Individual user contributions to their stable''s global challenge progress';
COMMENT ON TABLE public.global_challenge_rewards IS 'Rewards available for global challenges';
COMMENT ON TABLE public.user_global_challenge_rewards IS 'Tracking of rewards earned by users in global challenges';

-- Enable RLS (Row Level Security) for the new tables
ALTER TABLE public.global_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stable_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_stable_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_challenge_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_global_challenge_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for global_challenges (readable by all, manageable by admin)
CREATE POLICY "global_challenges_select_policy" ON public.global_challenges
    FOR SELECT USING (true);

CREATE POLICY "global_challenges_insert_policy" ON public.global_challenges
    FOR INSERT WITH CHECK (false); -- Only allow via functions/admin

CREATE POLICY "global_challenges_update_policy" ON public.global_challenges
    FOR UPDATE USING (false); -- Only allow via functions/admin

-- RLS Policies for stable_challenge_progress (readable by all for leaderboards)
CREATE POLICY "stable_progress_select_policy" ON public.stable_challenge_progress
    FOR SELECT USING (true);

CREATE POLICY "stable_progress_insert_policy" ON public.stable_challenge_progress
    FOR INSERT WITH CHECK (false); -- Only via triggers

CREATE POLICY "stable_progress_update_policy" ON public.stable_challenge_progress
    FOR UPDATE USING (false); -- Only via triggers

-- RLS Policies for individual_stable_contributions
CREATE POLICY "individual_contributions_select_policy" ON public.individual_stable_contributions
    FOR SELECT USING (
        -- Users can see their own contributions and their stable's contributions
        user_id = auth.uid() OR 
        stable_id IN (
            SELECT stable_id FROM public.stable_members 
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

CREATE POLICY "individual_contributions_insert_policy" ON public.individual_stable_contributions
    FOR INSERT WITH CHECK (
        -- Users can only insert their own contributions and must be stable member
        user_id = auth.uid() AND
        stable_id IN (
            SELECT stable_id FROM public.stable_members 
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

CREATE POLICY "individual_contributions_update_policy" ON public.individual_stable_contributions
    FOR UPDATE USING (
        -- Users can only update their own contributions
        user_id = auth.uid() AND
        stable_id IN (
            SELECT stable_id FROM public.stable_members 
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

-- RLS Policies for global_challenge_rewards (readable by all)
CREATE POLICY "global_rewards_select_policy" ON public.global_challenge_rewards
    FOR SELECT USING (true);

-- RLS Policies for user_global_challenge_rewards
CREATE POLICY "user_global_rewards_select_policy" ON public.user_global_challenge_rewards
    FOR SELECT USING (
        -- Users can see their own rewards and their stable's rewards
        user_id = auth.uid() OR
        stable_id IN (
            SELECT stable_id FROM public.stable_members 
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

CREATE POLICY "user_global_rewards_insert_policy" ON public.user_global_challenge_rewards
    FOR INSERT WITH CHECK (false); -- Only via reward system

-- Create the first monthly challenge
SELECT create_monthly_global_challenge();

-- Auto-enroll all existing stables
SELECT auto_enroll_stables_in_global_challenge(
    'global_monthly_' || to_char(date_trunc('month', NOW()), 'YYYY_MM')
);
