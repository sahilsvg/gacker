-- Leaderboard: rank every user by fire rate (red days / total logged days).
--
-- entries.select is deliberately locked to own rows + accepted followers
-- (20260705000000_rls_audit_and_fix.sql) -- a diary is not something a
-- stranger should be able to page through. A leaderboard needs to compare
-- everyone's numbers anyway, so this is a SECURITY DEFINER function rather
-- than a relaxed policy: it aggregates inside its own execution context,
-- bypassing the caller's RLS, but returns only counts and a fire rate --
-- never a date, a note, a photo, or anything else about what happened on any
-- single day. No new attack surface: this function can only ever hand back
-- the same shape of numbers Ganalytics already shows for your own profile.

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
    -- Same formula as Ganalytics' own fire-rate stat: redDays / total, as a
    -- percentage. Only users with at least one logged day are rankable.
    round(
      count(*) filter (where not e.clean)::numeric
        / nullif(count(*), 0) * 100,
      1
    ) as fire_rate
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where e.date <= current_date
  group by p.id, p.name, p.handle, p.avatar_url
  having count(*) > 0
  order by fire_rate asc, count(*) desc;
$$;

-- Callable by any signed-in user; the function itself is the access boundary.
revoke all on function public.get_fire_rate_leaderboard() from public;
grant execute on function public.get_fire_rate_leaderboard() to authenticated;
