-- Create vaccination_records table
CREATE TABLE IF NOT EXISTS public.vaccination_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  horse_id uuid NOT NULL,
  horse_name text NOT NULL,
  vaccine_name text NOT NULL,
  vaccination_date timestamp with time zone NOT NULL,
  next_due_date timestamp with time zone,
  notes text,
  reminder_enabled boolean DEFAULT false,
  repeat_enabled boolean DEFAULT false,
  repeat_interval_months integer CHECK (repeat_interval_months > 0 AND repeat_interval_months <= 60),
  veterinarian_name text,
  batch_number text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vaccination_records_pkey PRIMARY KEY (id),
  CONSTRAINT vaccination_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT vaccination_records_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES public.horses(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vaccination_records_user_id ON public.vaccination_records(user_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_horse_id ON public.vaccination_records(horse_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_next_due_date ON public.vaccination_records(next_due_date);

-- Enable RLS
ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own vaccination records"
  ON public.vaccination_records
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vaccination records"
  ON public.vaccination_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vaccination records"
  ON public.vaccination_records
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vaccination records"
  ON public.vaccination_records
  FOR DELETE
  USING (auth.uid() = user_id);
