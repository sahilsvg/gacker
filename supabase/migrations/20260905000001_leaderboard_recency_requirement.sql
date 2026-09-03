-- Drop a user off the leaderboard once they have gone quiet, as an incentive
-- toward consistent logging rather than a one-time bar to clear.
--
-- Rule (in the viewer's own local calendar, not the database's UTC clock):
-- ranked as long as the most recent entry is from today, yesterday, or the
-- day before. Two full missed days silently drops you off at the next local
-- midnight. Worked example: last logged Tuesday -> still ranked all day
-- Thursday (Tuesday is exactly 2 days back) -> dropped the moment it becomes
-- Friday (now 3 days back).
--
-- "Today" has to come from the caller rather than current_date: every other
-- day-boundary in this app (streak, calendar, reminders) is the device's
-- local date, and Postgres's current_date is the server's UTC date -- those
-- disagree for part of every day depending on the viewer's timezone. A
-- default of current_date is kept so the function still works if ever called
-- without the argument, but the client always passes its own local today.

-- create or replace only ever replaces a function with the exact same
-- signature -- adding a parameter here would otherwise leave the old
-- zero-argument version sitting alongside this one, still callable, still
-- running the previous current_date-based logic.
drop function if exists public.get_fire_rate_leaderboard();

create or replace function public.get_fire_rate_leaderboard(viewer_today date default current_date)
returns table (
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  clean_days bigint,
  red_days bigint,
  fire_rate numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id as user_id,
    p.name,
    p.handle,
    p.avatar_url,
    count(*) filter (where e.clean) as clean_days,
    count(*) filter (where not e.clean) as red_days,
    round(
      count(*) filter (where not e.clean)::numeric
        / nullif(count(*), 0) * 100,
      1
    ) as fire_rate
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where e.date <= viewer_today
  group by p.id, p.name, p.handle, p.avatar_url
  having count(*) >= 14
     and max(e.date) >= viewer_today - 2
  order by fire_rate asc, count(*) desc;
$$;

revoke all on function public.get_fire_rate_leaderboard(date) from public;
grant execute on function public.get_fire_rate_leaderboard(date) to authenticated;
