-- Create friendships table for user connections
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, friend_id),
    CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

-- Add RLS policies for friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own friendships and friendships where they are the friend
CREATE POLICY "Users can view their friendships" ON public.friendships
    FOR SELECT USING (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

-- Policy: Users can insert friendships where they are the user
CREATE POLICY "Users can create friendships" ON public.friendships
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Policy: Users can update friendships where they are involved
CREATE POLICY "Users can update their friendships" ON public.friendships
    FOR UPDATE USING (
        auth.uid() = user_id OR auth.uid() = friend_id
    ) WITH CHECK (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

-- Policy: Users can delete friendships where they are involved
CREATE POLICY "Users can delete their friendships" ON public.friendships
    FOR DELETE USING (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_friendships_updated_at
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
