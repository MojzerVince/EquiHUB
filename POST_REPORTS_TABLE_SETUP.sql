-- Create post_reports table for reporting functionality
CREATE TABLE IF NOT EXISTS post_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    
    -- Ensure a user can only report a post once
    UNIQUE(post_id, reporter_id)
);

-- Add RLS (Row Level Security) policies
ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own reports
CREATE POLICY "Users can create reports" ON post_reports
    FOR INSERT 
    WITH CHECK (auth.uid() = reporter_id);

-- Users can only view their own reports
CREATE POLICY "Users can view own reports" ON post_reports
    FOR SELECT 
    USING (auth.uid() = reporter_id);

-- Admin users can view and update all reports (you can modify this based on your admin system)
-- CREATE POLICY "Admins can manage all reports" ON post_reports
--     FOR ALL
--     USING (auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter_id ON post_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON post_reports(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_post_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_reports_updated_at
    BEFORE UPDATE ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_post_reports_updated_at();
