
CREATE TABLE public.hifz_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  memorized BOOLEAN NOT NULL DEFAULT false,
  peek_count INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, surah_number, ayah_number)
);

ALTER TABLE public.hifz_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own hifz progress"
  ON public.hifz_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hifz progress"
  ON public.hifz_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hifz progress"
  ON public.hifz_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
