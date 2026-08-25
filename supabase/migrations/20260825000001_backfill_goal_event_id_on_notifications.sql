-- Backfill goal_event_id onto goal notifications written before postGoalEvent
-- started capturing it, so those notifications can open their own feed post.
--
-- postGoalEvent inserts the goal_events row and its notifications in the same
-- call, so a notification matches the goal event with the same actor, event
-- type and goal_days whose created_at is closest to its own. Restricted to a
-- one-minute window and tie-broken by proximity; a user cannot legitimately
-- fire the same milestone twice for the same goal length inside a minute.
--
-- Only fills rows where a confident match exists — anything unmatched keeps a
-- null goal_event_id and stays inert, which is the current behaviour anyway.

with matched as (
  select
    n.id as notif_id,
    (
      select g.id
        from public.goal_events g
       where g.user_id = n.actor_id
         and g.event_type = n.type
         and g.goal_days = (n.data->>'goal_days')::int
         and g.created_at between n.created_at - interval '1 minute'
                              and n.created_at + interval '1 minute'
       order by abs(extract(epoch from (g.created_at - n.created_at)))
       limit 1
    ) as goal_event_id
  from public.notifications n
  where n.type in ('goal_set', 'goal_25', 'goal_50', 'goal_75', 'goal_met')
    and n.data->>'goal_event_id' is null
    and n.data->>'goal_days' is not null
    and n.actor_id is not null
)
update public.notifications n
   set data = n.data || jsonb_build_object('goal_event_id', m.goal_event_id)
  from matched m
 where n.id = m.notif_id
   and m.goal_event_id is not null;
