-- 1. Add parent_comment_id to comments (one level of replies, Instagram-style)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- 2. Comment likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, comment_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_select" ON public.comment_likes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "comment_likes_insert" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 3. Mentions (for both comments and entries)
CREATE TABLE IF NOT EXISTS public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentions_select" ON public.mentions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mentions_insert" ON public.mentions FOR INSERT WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "mentions_delete" ON public.mentions FOR DELETE USING (auth.uid() = actor_id);

-- 4. Add new notification types (extend the check or just allow all text — already open)
-- notifications.type is text so no enum change needed
