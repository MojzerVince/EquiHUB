-- Create planned_sessions table
CREATE TABLE public.planned_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  horse_id uuid NOT NULL,
  horse_name text NOT NULL,
  training_type character varying NOT NULL,
  title text NOT NULL,
  description text,
  planned_date timestamp with time zone NOT NULL,
  reminder_enabled boolean DEFAULT false,
  repeat_enabled boolean DEFAULT false,
  repeat_pattern character varying CHECK (repeat_pattern IN ('daily', 'weekly', 'monthly')),
  image_url text,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  actual_session_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT planned_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT planned_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT planned_sessions_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES public.horses(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_planned_sessions_user_id ON public.planned_sessions(user_id);
CREATE INDEX idx_planned_sessions_planned_date ON public.planned_sessions(planned_date);
CREATE INDEX idx_planned_sessions_user_date ON public.planned_sessions(user_id, planned_date);
CREATE INDEX idx_planned_sessions_is_completed ON public.planned_sessions(is_completed);

-- Enable Row Level Security
ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own planned sessions
CREATE POLICY "Users can view their own planned sessions"
  ON public.planned_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own planned sessions
CREATE POLICY "Users can insert their own planned sessions"
  ON public.planned_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own planned sessions
CREATE POLICY "Users can update their own planned sessions"
  ON public.planned_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own planned sessions
CREATE POLICY "Users can delete their own planned sessions"
  ON public.planned_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_planned_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_planned_sessions_updated_at
  BEFORE UPDATE ON public.planned_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_planned_sessions_updated_at();
