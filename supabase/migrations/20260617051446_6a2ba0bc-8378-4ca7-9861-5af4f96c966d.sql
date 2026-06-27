ALTER TABLE public.goon_tracker
  ADD COLUMN IF NOT EXISTS spotify_track_id text,
  ADD COLUMN IF NOT EXISTS spotify_track_name text,
  ADD COLUMN IF NOT EXISTS spotify_artist text,
  ADD COLUMN IF NOT EXISTS spotify_album_art text,
  ADD COLUMN IF NOT EXISTS spotify_preview_url text,
  ADD COLUMN IF NOT EXISTS snippet_start_ms integer,
  ADD COLUMN IF NOT EXISTS snippet_end_ms integer;