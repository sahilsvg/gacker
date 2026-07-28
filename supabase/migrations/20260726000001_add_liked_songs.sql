create table if not exists liked_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_name text not null,
  song_artist text not null,
  song_album_art text,
  song_preview_url text not null,
  liked_at timestamptz not null default now(),
  unique(user_id, song_preview_url)
);

alter table liked_songs enable row level security;

create policy "Users can manage their own liked songs"
  on liked_songs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
