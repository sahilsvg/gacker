ALTER TABLE public.goon_tracker ADD COLUMN owner text NOT NULL DEFAULT 'helium';
ALTER TABLE public.goon_tracker DROP CONSTRAINT IF EXISTS goon_tracker_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS goon_tracker_owner_date_key ON public.goon_tracker(owner, date);