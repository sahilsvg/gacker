-- Streak now counts days since the last red day, so it advances with the
-- calendar rather than with logging. Anything that fires when a streak crosses
-- a threshold can no longer detect that by comparing the streak before and
-- after a log — the two are often identical. Each of those needs its own
-- high-water mark so a milestone fires once and never re-fires.

-- Highest goal milestone (in streak-days) already posted for this goal.
alter table public.goals
  add column if not exists last_milestone_day integer not null default 0;

-- Rows that existed before milestone tracking and before the streak change.
-- A legacy goal the streak has already passed is closed out quietly: it was
-- likely met long ago, and announcing it now would be stale news to followers.
alter table public.goals
  add column if not exists legacy boolean not null default false;

update public.goals set legacy = true where created_at < now();

-- Highest streak_milestone (3/7/14/…) already announced for this user.
alter table public.profiles
  add column if not exists last_streak_notified integer not null default 0;
