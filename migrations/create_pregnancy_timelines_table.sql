-- Pregnancy Timeline Table
CREATE TABLE public.pregnancy_timelines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  horse_id uuid NOT NULL,
  horse_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'foaled', 'lost')),
  cover_date timestamp with time zone NOT NULL,
  ovulation_date timestamp with time zone,
  due_date_estimate timestamp with time zone NOT NULL,
  due_window_start timestamp with time zone NOT NULL,
  due_window_end timestamp with time zone NOT NULL,
  stallion text,
  breeding_method text CHECK (breeding_method IN ('natural', 'AI', 'ICSI')),
  vet_info jsonb DEFAULT '{}'::jsonb,
  events jsonb NOT NULL DEFAULT '{
    "checks": [],
    "vaccines": [],
    "husbandry": {},
    "deworming": [],
    "milkCalcium": [],
    "photos": [],
    "alerts": []
  }'::jsonb,
  foaling_details jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pregnancy_timelines_pkey PRIMARY KEY (id),
  CONSTRAINT pregnancy_timelines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT pregnancy_timelines_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES public.horses(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX idx_pregnancy_timelines_user_id ON public.pregnancy_timelines(user_id);
CREATE INDEX idx_pregnancy_timelines_horse_id ON public.pregnancy_timelines(horse_id);
CREATE INDEX idx_pregnancy_timelines_status ON public.pregnancy_timelines(status);

-- Enable Row Level Security
ALTER TABLE public.pregnancy_timelines ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own pregnancy timelines"
  ON public.pregnancy_timelines
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pregnancy timelines"
  ON public.pregnancy_timelines
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pregnancy timelines"
  ON public.pregnancy_timelines
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pregnancy timelines"
  ON public.pregnancy_timelines
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_pregnancy_timelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pregnancy_timelines_updated_at
  BEFORE UPDATE ON public.pregnancy_timelines
  FOR EACH ROW
  EXECUTE FUNCTION update_pregnancy_timelines_updated_at();
