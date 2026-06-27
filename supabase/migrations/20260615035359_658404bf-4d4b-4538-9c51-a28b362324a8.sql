ALTER TABLE public.goon_tracker
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_name text;