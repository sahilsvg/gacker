ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clean_day_goal integer CHECK (clean_day_goal >= 1 AND clean_day_goal <= 200);
