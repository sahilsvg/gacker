-- Goals become instances with a lifecycle, instead of a single mutable integer
-- on profiles. Without a start point and a terminal state, a goal could absorb
-- days earned before it was set, could never record completion if the streak
-- was already past the target, and left "Complete!" showing forever.

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_days integer not null check (target_days > 0),
  -- Streak at the moment the goal was set. Recorded for history; progress is
  -- measured against the streak itself, so a goal is "reach an N-day streak".
  start_streak integer not null default 0,
  -- No 'broken': a relapse resets progress but the goal stays active, so the
  -- user has something to keep climbing toward rather than a dead goal.
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one active goal per user. Partial, so completed and abandoned rows
-- accumulate freely as history.
create unique index if not exists goals_one_active_per_user
  on public.goals (user_id) where status = 'active';

create index if not exists goals_user_created_idx
  on public.goals (user_id, created_at desc);

alter table public.goals enable row level security;

drop policy if exists "goals_select" on public.goals;
drop policy if exists "goals_insert" on public.goals;
drop policy if exists "goals_update" on public.goals;

-- Readable by any authenticated user so the Goals tab works on other profiles;
-- the app gates that behind the same follow check as History.
create policy "goals_select" on public.goals
  for select using (auth.uid() is not null);
create policy "goals_insert" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update" on public.goals
  for update using (auth.uid() = user_id);

-- Carry existing profiles.clean_day_goal over as an active goal. start_streak
-- is 0 because the old model never recorded one. Any of these already met by
-- the user's current streak get completed silently on next app load — dating
-- them now would be a lie, and notifying followers about a goal set weeks ago
-- would be spam.
insert into public.goals (user_id, target_days, start_streak, status)
select p.id, p.clean_day_goal, 0, 'active'
  from public.profiles p
 where p.clean_day_goal is not null
   and p.clean_day_goal > 0
   and not exists (
     select 1 from public.goals g
      where g.user_id = p.id and g.status = 'active'
   );
