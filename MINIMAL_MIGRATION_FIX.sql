-- MINIMAL MIGRATION: Create missing stable_challenge_progress table and triggers
-- Run this in your Supabase SQL Editor

-- 1. Create stable_challenge_progress table
CREATE TABLE IF NOT EXISTS public.stable_challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL,
    stable_id UUID NOT NULL,
    stable_name TEXT NOT NULL,
    progress_value DECIMAL(10,2) DEFAULT 0.00,
    member_count INTEGER DEFAULT 0,
    average_contribution DECIMAL(10,2) DEFAULT 0.00,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    rank INTEGER DEFAULT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_stable_challenge_progress_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES public.global_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_stable_challenge_progress_stable_id 
        FOREIGN KEY (stable_id) REFERENCES public.stables(id) ON DELETE CASCADE,
    CONSTRAINT uq_stable_challenge_progress_challenge_stable 
        UNIQUE (challenge_id, stable_id)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_challenge_id ON public.stable_challenge_progress (challenge_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_stable_id ON public.stable_challenge_progress (stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_rank ON public.stable_challenge_progress (challenge_id, rank);
CREATE INDEX IF NOT EXISTS idx_stable_challenge_progress_value ON public.stable_challenge_progress (challenge_id, progress_value DESC);

-- 3. Create trigger function to update stable progress
CREATE OR REPLACE FUNCTION update_stable_progress_from_contributions()
RETURNS TRIGGER AS $$
DECLARE
    stable_total DECIMAL(10,2);
    active_members INTEGER;
    avg_contribution DECIMAL(10,2);
BEGIN
    -- Calculate stable's total contribution and member count
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

-- 4. Create ranking update function
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

-- 5. Create trigger
DROP TRIGGER IF EXISTS trigger_update_stable_progress ON public.individual_stable_contributions;
CREATE TRIGGER trigger_update_stable_progress
    AFTER INSERT OR UPDATE OF contribution OR DELETE
    ON public.individual_stable_contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_stable_progress_from_contributions();

-- 6. Auto-enroll function for stables
CREATE OR REPLACE FUNCTION auto_enroll_stables_in_global_challenge(challenge_uuid TEXT)
RETURNS void AS $$
BEGIN
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

-- 7. Enable RLS on stable_challenge_progress
ALTER TABLE public.stable_challenge_progress ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies
DROP POLICY IF EXISTS "Allow public read access to stable progress" ON public.stable_challenge_progress;
CREATE POLICY "Allow public read access to stable progress"
    ON public.stable_challenge_progress
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow system to manage stable progress" ON public.stable_challenge_progress;
CREATE POLICY "Allow system to manage stable progress"
    ON public.stable_challenge_progress
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verification queries
SELECT 'Tables created successfully!' as status;

-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'stable_challenge_progress';

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'individual_stable_contributions' 
AND trigger_name = 'trigger_update_stable_progress';
