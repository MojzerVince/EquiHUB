# Push Notifications Database Setup

Add this table to your Supabase database to support push notifications for friend requests and other features.

## Create Push Tokens Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create user push tokens table for storing device push notification tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, push_token)
);

-- Enable Row Level Security
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for push tokens
-- Users can only see and modify their own push tokens
CREATE POLICY "Users can view own push tokens" ON user_push_tokens
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own push tokens" ON user_push_tokens
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own push tokens" ON user_push_tokens
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own push tokens" ON user_push_tokens
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_user_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER user_push_tokens_updated_at
    BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_user_push_tokens_updated_at();
```

## Create Notification History Table (Optional)

For tracking sent notifications:

```sql
-- Create notification history table to track sent notifications
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    push_token_used TEXT,
    delivery_status VARCHAR(20) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'read'))
);

-- Enable Row Level Security
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification history
-- Users can only see notifications sent to them
CREATE POLICY "Users can view own notifications" ON notification_history
    FOR SELECT USING (auth.uid()::text = recipient_user_id::text);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_history_recipient ON notification_history(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_read ON notification_history(read_at);
```

## Test the Setup

After running the SQL commands above, verify the tables exist:

```sql
-- Check if tables were created successfully
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_push_tokens', 'notification_history');

-- Check the table structure
\d user_push_tokens
\d notification_history
```

## Features Enabled

✅ **Push Token Storage**: Device tokens securely stored per user
✅ **Multiple Devices**: Support for users with multiple devices
✅ **RLS Security**: Only users can access their own tokens
✅ **Notification History**: Track all sent notifications (optional)
✅ **Performance Optimized**: Proper indexing for fast queries
✅ **Auto Timestamps**: Automatic created_at and updated_at tracking

## Dependencies

This setup requires:

- `profiles` table (should already exist)
- Supabase Auth enabled
- RLS policies properly configured

## Next Steps

1. Run the SQL commands in your Supabase dashboard
2. Update your app to register for push notifications
3. Test friend request notifications
4. Optionally implement notification history features
