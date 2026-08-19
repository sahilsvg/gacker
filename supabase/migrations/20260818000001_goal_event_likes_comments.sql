-- Let likes and comments hang off a goal_event as well as an entry.
--
-- Polymorphic rather than parallel goal_event_likes / goal_event_comments
-- tables, so goal posts reuse the existing comment stack as-is: threaded
-- replies (parent_comment_id), comment_likes, and mentions all keep working
-- with no duplication.

-- ---------------------------------------------------------------- likes
alter table public.likes
  add column if not exists goal_event_id uuid references public.goal_events(id) on delete cascade;

alter table public.likes alter column entry_id drop not null;

-- Exactly one target, never both, never neither.
alter table public.likes drop constraint if exists likes_one_target;
alter table public.likes add constraint likes_one_target
  check (num_nonnulls(entry_id, goal_event_id) = 1);

-- One like per user per goal event. Partial so it does not collide with the
-- existing (user_id, entry_id) uniqueness on entry likes.
create unique index if not exists likes_user_goal_event_key
  on public.likes (user_id, goal_event_id) where goal_event_id is not null;

create index if not exists likes_goal_event_idx
  on public.likes (goal_event_id) where goal_event_id is not null;

-- ------------------------------------------------------------- comments
alter table public.comments
  add column if not exists goal_event_id uuid references public.goal_events(id) on delete cascade;

alter table public.comments alter column entry_id drop not null;

alter table public.comments drop constraint if exists comments_one_target;
alter table public.comments add constraint comments_one_target
  check (num_nonnulls(entry_id, goal_event_id) = 1);

create index if not exists comments_goal_event_idx
  on public.comments (goal_event_id) where goal_event_id is not null;
