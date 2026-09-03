-- Exclude barely-used accounts from the leaderboard.
--
-- A user with only 1-2 logged days can sit at a trivial 0% or 100% fire rate
-- purely from small sample size, crowding out people who are actually using
-- the app day to day. Checked against real data: every genuinely active user
-- has 51+ logged days; every outlier (one-off testers, an App Store reviewer
-- account, a QA account) has 12 or fewer. 14 days (two weeks) sits cleanly in
-- the gap between them, with room either side as the beta grows.

create or replace function public.get_fire_rate_leaderboard()
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
  where e.date <= current_date
  group by p.id, p.name, p.handle, p.avatar_url
  having count(*) >= 14
  order by fire_rate asc, count(*) desc;
$$;

revoke all on function public.get_fire_rate_leaderboard() from public;
grant execute on function public.get_fire_rate_leaderboard() to authenticated;
