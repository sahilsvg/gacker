-- Quotes shown as scheduled local notifications through the day. Managed from
-- the Supabase dashboard so the list can change without shipping a build.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(trim(body)) between 1 and 240),
  author text,
  -- Lets a quote be retired without deleting it, keeping the history intact.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists quotes_active_idx on public.quotes (active) where active;

alter table public.quotes enable row level security;

drop policy if exists "quotes_select" on public.quotes;

-- Read-only to the app. Inserts and edits happen in the dashboard, which uses
-- the service role and bypasses RLS, so no write policy is wanted here.
create policy "quotes_select" on public.quotes
  for select using (auth.uid() is not null);

insert into public.quotes (body, author) values
  ('The obstacle is the way.', 'Marcus Aurelius'),
  ('You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'),
  ('Discipline is choosing between what you want now and what you want most.', null),
  ('Rock bottom became the solid foundation on which I rebuilt my life.', 'J.K. Rowling'),
  ('It does not matter how slowly you go as long as you do not stop.', 'Confucius'),
  ('Every day is a new beginning. Take a deep breath and start again.', null),
  ('You are not required to be perfect. You are required to keep going.', null),
  ('Courage is not having the strength to go on. It is going on when you have no strength.', null)
on conflict do nothing;
