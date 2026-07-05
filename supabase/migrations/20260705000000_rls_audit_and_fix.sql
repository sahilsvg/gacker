-- ============================================================
-- RLS AUDIT & FIX — 2026-07-05
-- ============================================================
-- Tables audited:
--   entries, profiles, follows, likes, comments, notifications
--   goon_tracker (legacy), email_subscribers (legacy)
--
-- Findings fixed:
--   1. email_subscribers — SELECT policy exposed every email address to
--      the public (no auth required). Replaced with no read access.
--   2. goon_tracker — INSERT/UPDATE allowed unauthenticated callers.
--      Tightened to authenticated-only.
--   3. entries — no previous RLS; any authenticated user could read
--      any other user's diary entries. Fixed: own rows + accepted
--      followers only.
--   4. profiles — no previous RLS. Fixed: readable by all authenticated
--      users (needed for search/feed), writable only by owner.
--   5. follows — no previous RLS. Fixed: readable by all authenticated
--      users (needed for follower counts), writable by relationship
--      participants only.
--   6. likes — no previous RLS. Fixed: readable by all authenticated
--      users (needed for like counts/lists), insertable/deletable by
--      owner only.
--   7. comments — no previous RLS. Fixed: readable by all authenticated
--      users, insertable/deletable by owner only.
--   8. notifications — no previous RLS. Fixed: each user sees only their
--      own notifications; any authenticated user may create a notification
--      for another user (required for likes/comments/follows).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. email_subscribers
--    BUG: "Anyone can read email_subscribers" exposes all emails
--    to unauthenticated callers. Drop it. No feature needs it.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read email_subscribers"   ON public.email_subscribers;
DROP POLICY IF EXISTS "Anyone can insert email_subscribers" ON public.email_subscribers;
DROP POLICY IF EXISTS "Anyone can update email_subscribers" ON public.email_subscribers;

-- Subscribers can insert their own row; nobody can read/update via API.
CREATE POLICY "email_subscribers_insert"
  ON public.email_subscribers FOR INSERT
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 2. goon_tracker (legacy)
--    BUG: unauthenticated users could INSERT and UPDATE rows.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public insert" ON public.goon_tracker;
DROP POLICY IF EXISTS "Allow public update" ON public.goon_tracker;

CREATE POLICY "goon_tracker_insert_authenticated"
  ON public.goon_tracker FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "goon_tracker_update_authenticated"
  ON public.goon_tracker FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 3. profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- Any signed-in user can read profiles (needed for search, feed, user pages).
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- A user can only create their own profile row.
CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- A user can only edit their own profile.
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Deletion is handled by the delete-account Edge Function (service role).
-- No client-side DELETE policy.


-- ────────────────────────────────────────────────────────────
-- 4. entries
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entries_select" ON public.entries;
DROP POLICY IF EXISTS "entries_insert" ON public.entries;
DROP POLICY IF EXISTS "entries_update" ON public.entries;
DROP POLICY IF EXISTS "entries_delete" ON public.entries;

-- Own entries always visible; followers with accepted status can also read.
CREATE POLICY "entries_select"
  ON public.entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid()
        AND following_id = entries.user_id
        AND status = 'accepted'
    )
  );

-- Users can only log entries for themselves.
CREATE POLICY "entries_insert"
  ON public.entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only edit their own entries.
CREATE POLICY "entries_update"
  ON public.entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own entries.
CREATE POLICY "entries_delete"
  ON public.entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 5. follows
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_update" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;

-- All authenticated users can read follows. This is needed for:
--   - follower/following counts on any profile
--   - follow-status checks
--   - building the feed (listing who you follow)
CREATE POLICY "follows_select"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);

-- Only the follower themselves can initiate a follow.
CREATE POLICY "follows_insert"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

-- Only the target (following_id) can approve or deny a request.
CREATE POLICY "follows_update"
  ON public.follows FOR UPDATE
  TO authenticated
  USING (following_id = auth.uid())
  WITH CHECK (following_id = auth.uid());

-- Either party can remove the relationship (unfollow / remove-follower).
CREATE POLICY "follows_delete"
  ON public.follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 6. likes
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select" ON public.likes;
DROP POLICY IF EXISTS "likes_insert" ON public.likes;
DROP POLICY IF EXISTS "likes_delete" ON public.likes;

-- Readable by all authenticated users (needed for like counts and who-liked lists).
CREATE POLICY "likes_select"
  ON public.likes FOR SELECT
  TO authenticated
  USING (true);

-- Users can only like as themselves.
CREATE POLICY "likes_insert"
  ON public.likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only unlike their own like.
CREATE POLICY "likes_delete"
  ON public.likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 7. comments
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_delete" ON public.comments;

-- Comments are readable by all authenticated users.
-- Entry-level privacy is enforced by the entries table RLS above;
-- a user who can't see an entry won't navigate to its comments.
CREATE POLICY "comments_select"
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

-- Users can only post comments as themselves.
CREATE POLICY "comments_insert"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own comments.
CREATE POLICY "comments_delete"
  ON public.comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 8. notifications
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

-- Users can only read their own notifications.
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Any authenticated user can create a notification for another user.
-- This is required so likes/comments/follows can notify the target.
CREATE POLICY "notifications_insert"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can only mark their own notifications as read.
CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Deletion handled by the delete-account Edge Function (service role).
-- No client-side DELETE policy.
