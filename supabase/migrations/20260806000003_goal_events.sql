create table if not exists public.goal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('goal_set', 'goal_met')),
  goal_days integer not null,
  created_at timestamptz not null default now()
);

alter table public.goal_events enable row level security;

create policy "goal_events_select" on public.goal_events
  for select using (auth.uid() is not null);

create policy "goal_events_insert" on public.goal_events
  for insert with check (auth.uid() = user_id);
