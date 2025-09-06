-- Emergency SMS Log Table
-- This table stores logs of emergency SMS messages sent through the server

CREATE TABLE IF NOT EXISTS emergency_sms_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    message_text TEXT NOT NULL,
    emergency_type TEXT NOT NULL CHECK (emergency_type IN ('fall_detection', 'manual_emergency', 'test')),
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    contacts_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT false,
    provider_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Delivery Status Table
-- This table tracks the delivery status of individual SMS messages

CREATE TABLE IF NOT EXISTS sms_delivery_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    emergency_sms_log_id UUID NOT NULL REFERENCES emergency_sms_log(id),
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency Contacts Table (if not already exists)
-- Stores user's emergency contacts

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, phone_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emergency_sms_log_user_id ON emergency_sms_log(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_sms_log_created_at ON emergency_sms_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_status_log_id ON sms_delivery_status(emergency_sms_log_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE emergency_sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_delivery_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own SMS logs
CREATE POLICY "Users can view own SMS logs" ON emergency_sms_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SMS logs" ON emergency_sms_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see delivery status for their own SMS
CREATE POLICY "Users can view own SMS delivery status" ON sms_delivery_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM emergency_sms_log 
            WHERE emergency_sms_log.id = sms_delivery_status.emergency_sms_log_id 
            AND emergency_sms_log.user_id = auth.uid()
        )
    );

-- Service role can update delivery status
CREATE POLICY "Service can update SMS delivery status" ON sms_delivery_status
    FOR UPDATE USING (true);

-- Users can manage their own emergency contacts
CREATE POLICY "Users can manage own emergency contacts" ON emergency_contacts
    FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT ON emergency_sms_log TO authenticated;
GRANT SELECT ON sms_delivery_status TO authenticated;
GRANT ALL ON emergency_contacts TO authenticated;

-- Grant service role permissions for SMS delivery updates
GRANT UPDATE ON sms_delivery_status TO service_role;
