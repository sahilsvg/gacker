import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/lib/notifications';
import { computeStats, Entry } from '@/lib/entries';

// Current streak per user, from the same computeStats the profile uses, so the
// pill on a post and the STREAK stat on that profile can never disagree.
// Streak walks back from today, so it cannot be stored — it goes stale as soon
// as a day passes without logging.
const streaksByUser = async (userIds: string[]): Promise<Record<string, number>> => {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from('entries')
    .select('user_id, date, clean')
    .in('user_id', userIds);

  const byUser: Record<string, Record<string, Entry>> = {};
  for (const row of (data ?? []) as any[]) {
    (byUser[row.user_id] ??= {})[row.date] = row as Entry;
  }
  return Object.fromEntries(
    userIds.map(id => [id, computeStats(byUser[id] ?? {}).streak]),
  );
};

// goal_25 / goal_50 / goal_75 are progress milestones; goal_met is 100%.
// Must stay in sync with the check constraint on public.goal_events.
export type GoalEventType = 'goal_set' | 'goal_25' | 'goal_50' | 'goal_75' | 'goal_met';

// Likes and comments can hang off either an entry or a goal event. Defaults to
// 'entry' everywhere so existing call sites read unchanged.
export type TargetKind = 'entry' | 'goal_event';
const targetCol = (kind: TargetKind) => (kind === 'entry' ? 'entry_id' : 'goal_event_id');

export interface FeedItem {
  id: string;
  user_id: string;
  date: string;
  clean: boolean;
  notes: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  song_name?: string | null;
  song_artist?: string | null;
  song_album_art?: string | null;
  song_preview_url?: string | null;
  image_url?: string | null;
  profile: { id: string; name: string; handle: string; avatar_url: string | null };
  // Author's current streak and goal, shown as pills on the card. Current
  // values rather than values at post time, so they match their profile.
  authorStreak?: number;
  authorGoal?: number | null;
  likeCount: number;
  iLiked: boolean;
  commentCount: number;
  // Goal event fields (only present on goal event items)
  event_type?: GoalEventType;
  goal_days?: number;
}

export interface Comment {
  id: string;
  user_id: string;
  entry_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  like_count: number;
  i_liked: boolean;
  profile: { name: string; handle: string; avatar_url: string | null };
  replies: Comment[];
}

export interface SearchProfile {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
}

// Likes/comments for a batch of ids of either kind, shared by getFeed and
// getMyActivity so their counts cannot drift apart.
const fetchEngagement = async (ids: string[], kind: TargetKind) => {
  if (ids.length === 0) return { likes: [] as any[], comments: [] as any[] };
  const col = targetCol(kind);
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('likes').select(`${col}, user_id`).in(col, ids),
    supabase.from('comments').select(col).in(col, ids),
  ]);
  return { likes: likesRes.data ?? [], comments: commentsRes.data ?? [] };
};

const fetchGoalEngagement = (goalIds: string[]) => fetchEngagement(goalIds, 'goal_event');

const goalEventsToFeedItems = (
  events: any[],
  profileMap: Record<string, any>,
  likes: any[],
  comments: any[],
  userId: string,
): FeedItem[] =>
  events.map(e => ({
    id: e.id,
    user_id: e.user_id,
    date: e.created_at.slice(0, 10),
    clean: true,
    notes: null,
    created_at: e.created_at,
    profile: profileMap[e.user_id],
    likeCount: likes.filter(l => l.goal_event_id === e.id).length,
    iLiked: likes.some(l => l.goal_event_id === e.id && l.user_id === userId),
    commentCount: comments.filter(c => c.goal_event_id === e.id).length,
    event_type: e.event_type as GoalEventType,
    goal_days: e.goal_days,
  }));

export const getFeed = async (userId: string): Promise<FeedItem[]> => {
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted');

  const followingIds = (follows ?? []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  const [entriesRes, profilesRes, goalEventsRes, streaks] = await Promise.all([
    supabase.from('entries').select('*').in('user_id', followingIds).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, name, handle, avatar_url, clean_day_goal').in('id', followingIds),
    supabase.from('goal_events').select('*').in('user_id', followingIds).order('created_at', { ascending: false }).limit(50),
    streaksByUser(followingIds),
  ]);

  const entries = entriesRes.data ?? [];
  const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p]));
  const entryIds = entries.map(e => e.id);

  const [likesRes, commentsRes] = entryIds.length > 0
    ? await Promise.all([
        supabase.from('likes').select('entry_id, user_id').in('entry_id', entryIds),
        supabase.from('comments').select('entry_id').in('entry_id', entryIds),
      ])
    : [{ data: [] }, { data: [] }];

  const likes = likesRes.data ?? [];
  const comments = commentsRes.data ?? [];

  const entryItems: FeedItem[] = entries.map(entry => ({
    ...entry,
    profile: profileMap[entry.user_id],
    authorStreak: streaks[entry.user_id] ?? 0,
    authorGoal: profileMap[entry.user_id]?.clean_day_goal ?? null,
    likeCount: likes.filter(l => l.entry_id === entry.id).length,
    iLiked: likes.some(l => l.entry_id === entry.id && l.user_id === userId),
    commentCount: comments.filter(c => c.entry_id === entry.id).length,
  }));

  const goalEvents = goalEventsRes.data ?? [];
  const goalEng = await fetchGoalEngagement(goalEvents.map((e: any) => e.id));
  const goalItems = goalEventsToFeedItems(goalEvents, profileMap, goalEng.likes, goalEng.comments, userId);

  return [...entryItems, ...goalItems].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const getMyActivity = async (userId: string): Promise<FeedItem[]> => {
  const [entriesRes, profileRes, goalEventsRes] = await Promise.all([
    supabase.from('entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, name, handle, avatar_url, clean_day_goal').eq('id', userId).maybeSingle(),
    supabase.from('goal_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ]);

  const entries = entriesRes.data ?? [];
  const profile = profileRes.data;
  const profileMap = profile ? { [profile.id]: profile } : {};

  const entryIds = entries.map(e => e.id);
  const [likesRes, commentsRes] = entryIds.length > 0
    ? await Promise.all([
        supabase.from('likes').select('entry_id, user_id').in('entry_id', entryIds),
        supabase.from('comments').select('entry_id').in('entry_id', entryIds),
      ])
    : [{ data: [] }, { data: [] }];

  const likes = likesRes.data ?? [];
  const comments = commentsRes.data ?? [];

  // Not computed from `entries` above: that is capped at 50 rows, which would
  // truncate a long streak and disagree with the profile's STREAK stat.
  const myStreak = (await streaksByUser([userId]))[userId] ?? 0;

  const entryItems: FeedItem[] = entries.map(entry => ({
    ...entry,
    profile,
    authorStreak: myStreak,
    authorGoal: (profile as any)?.clean_day_goal ?? null,
    likeCount: likes.filter(l => l.entry_id === entry.id).length,
    iLiked: likes.some(l => l.entry_id === entry.id && l.user_id === userId),
    commentCount: comments.filter(c => c.entry_id === entry.id).length,
  }));

  const goalEvents = goalEventsRes.data ?? [];
  const goalEng = await fetchGoalEngagement(goalEvents.map((e: any) => e.id));
  const goalItems = goalEventsToFeedItems(goalEvents, profileMap, goalEng.likes, goalEng.comments, userId);

  return [...entryItems, ...goalItems].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

// Streak-day thresholds at which each milestone fires, ascending.
// Percentages round up, so a 10-day goal fires at 3 / 5 / 8 / 10.
// Short goals can collide (a 2-day goal puts 25% and 50% both on day 1);
// the later, higher milestone wins so you never get two posts on one day.
export const goalMilestones = (goalDays: number): { type: GoalEventType; day: number }[] => {
  const byDay = new Map<number, GoalEventType>();
  const steps: [GoalEventType, number][] = [
    ['goal_25', 0.25], ['goal_50', 0.5], ['goal_75', 0.75], ['goal_met', 1],
  ];
  for (const [type, pct] of steps) {
    byDay.set(Math.max(1, Math.ceil(goalDays * pct)), type);
  }
  return [...byDay.entries()]
    .map(([day, type]) => ({ day, type }))
    .sort((a, b) => a.day - b.day);
};

// Post a goal event and notify followers
export const postGoalEvent = async (
  userId: string,
  eventType: GoalEventType,
  goalDays: number,
  followerIds: string[],
) => {
  const { data: event, error } = await supabase
    .from('goal_events')
    .insert({ user_id: userId, event_type: eventType, goal_days: goalDays })
    .select('id')
    .single();
  // Surface failures instead of swallowing them — a missing table or a failed
  // check constraint here is otherwise completely silent.
  if (error) {
    console.warn('[goal_events] insert failed:', error.message);
    return;
  }
  const targets = followerIds.filter(id => id !== userId);
  if (targets.length > 0) {
    await supabase.from('notifications').insert(
      targets.map(uid => ({
        user_id: uid,
        type: eventType,
        actor_id: userId,
        // goal_event_id lets the notification open its own feed post. It cannot
        // be backfilled onto rows written before this existed, so it must be
        // captured at insert time.
        data: { goal_days: goalDays, goal_event_id: event.id },
      }))
    );
  }
};

export const toggleLike = async (
  userId: string,
  targetId: string,
  iLiked: boolean,
  ownerId?: string,
  kind: TargetKind = 'entry',
) => {
  const col = targetCol(kind);
  if (iLiked) {
    await supabase.from('likes').delete().eq('user_id', userId).eq(col, targetId);
  } else {
    await supabase.from('likes').insert({ user_id: userId, [col]: targetId });
    if (ownerId) createNotification(ownerId, 'like', userId, { [col]: targetId });
  }
};

export const getComments = async (
  targetId: string,
  currentUserId?: string,
  kind: TargetKind = 'entry',
): Promise<Comment[]> => {
  const { data: rows } = await supabase
    .from('comments')
    .select('id, user_id, entry_id, goal_event_id, parent_comment_id, body, created_at')
    .eq(targetCol(kind), targetId)
    .order('created_at', { ascending: true });

  if (!rows || rows.length === 0) return [];

  const commentIds = rows.map(c => c.id);
  const userIds = [...new Set(rows.map(c => c.user_id))];

  const [profilesRes, likesRes, myLikesRes] = await Promise.all([
    supabase.from('profiles').select('id, name, handle, avatar_url').in('id', userIds),
    supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds),
    currentUserId
      ? supabase.from('comment_likes').select('comment_id').eq('user_id', currentUserId).in('comment_id', commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p]));
  const likeCountMap: Record<string, number> = {};
  (likesRes.data ?? []).forEach(l => { likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] ?? 0) + 1; });
  const myLikedSet = new Set((myLikesRes.data ?? []).map((l: any) => l.comment_id));

  const enriched: Comment[] = rows.map(c => ({
    ...c,
    profile: profileMap[c.user_id],
    like_count: likeCountMap[c.id] ?? 0,
    i_liked: myLikedSet.has(c.id),
    replies: [],
  }));

  // Nest replies under their parent (one level only)
  const rootComments: Comment[] = [];
  const byId: Record<string, Comment> = {};
  enriched.forEach(c => { byId[c.id] = c; });
  enriched.forEach(c => {
    if (c.parent_comment_id && byId[c.parent_comment_id]) {
      byId[c.parent_comment_id].replies.push(c);
    } else {
      rootComments.push(c);
    }
  });
  return rootComments;
};

export const postComment = async (
  userId: string,
  targetId: string,
  body: string,
  opts: {
    entryOwnerId?: string;
    parentCommentId?: string | null;
    parentCommentOwnerId?: string | null;
    mentionedUserIds?: string[];
    kind?: TargetKind;
  } = {}
): Promise<string | null> => {
  const { entryOwnerId, parentCommentId, parentCommentOwnerId, mentionedUserIds = [], kind = 'entry' } = opts;
  const col = targetCol(kind);
  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, [col]: targetId, body, parent_comment_id: parentCommentId ?? null })
    .select('id')
    .single();
  if (error) return error.message;

  const commentId = inserted.id;
  const notified = new Set<string>();
  // Notification payloads key the target by its own column so the app can tell
  // an entry thread from a goal-event thread when deep-linking later.
  const ref = { [col]: targetId };

  // Reply notification takes priority over mention for the parent comment owner
  if (parentCommentOwnerId && parentCommentOwnerId !== userId) {
    createNotification(parentCommentOwnerId, 'comment_reply', userId, { ...ref, comment_id: commentId, body: body.slice(0, 80) });
    notified.add(parentCommentOwnerId);
  }

  // Mention notifications (skip if already sent a reply notif to this user).
  // mentions.entry_id is nullable and only references entries, so it stays null
  // for goal-event threads — comment_id is enough to locate the mention.
  const mentionTargets = mentionedUserIds.filter(id => id !== userId && !notified.has(id));
  if (mentionTargets.length > 0) {
    await supabase.from('mentions').insert(mentionTargets.map(uid => ({
      mentioned_user_id: uid,
      comment_id: commentId,
      entry_id: kind === 'entry' ? targetId : null,
      actor_id: userId,
    })));
    for (const uid of mentionTargets) {
      createNotification(uid, 'mention_comment', userId, { ...ref, comment_id: commentId, body: body.slice(0, 80) });
      notified.add(uid);
    }
  }

  // Post owner notification (plain comment, only if not already notified above)
  if (entryOwnerId && !notified.has(entryOwnerId) && entryOwnerId !== userId) {
    createNotification(entryOwnerId, 'comment', userId, { ...ref, comment_id: commentId, body: body.slice(0, 80) });
  }

  return null;
};

export const toggleCommentLike = async (userId: string, commentId: string, commentOwnerId: string, iLiked: boolean) => {
  if (iLiked) {
    await supabase.from('comment_likes').delete().eq('user_id', userId).eq('comment_id', commentId);
  } else {
    await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId });
    createNotification(commentOwnerId, 'comment_like', userId, { comment_id: commentId });
  }
};

// Resolve @handles in text to user IDs (for mention notifications)
export const resolveHandles = async (handles: string[]): Promise<Record<string, string>> => {
  if (handles.length === 0) return {};
  const { data } = await supabase.from('profiles').select('id, handle').in('handle', handles);
  return Object.fromEntries((data ?? []).map(p => [p.handle, p.id]));
};

// Search followed users by handle prefix for @mention autocomplete
export const searchFollowedByHandle = async (currentUserId: string, prefix: string): Promise<SearchProfile[]> => {
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .eq('status', 'accepted');
  const ids = (follows ?? []).map(f => f.following_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, name, handle, avatar_url')
    .in('id', ids)
    .ilike('handle', `${prefix}%`)
    .limit(5);
  return data ?? [];
};

export const getLikes = async (targetId: string, kind: TargetKind = 'entry'): Promise<SearchProfile[]> => {
  const { data: likes } = await supabase.from('likes').select('user_id').eq(targetCol(kind), targetId);
  if (!likes || likes.length === 0) return [];
  const userIds = likes.map(l => l.user_id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, handle, avatar_url').in('id', userIds);
  return profiles ?? [];
};

export const deleteComment = async (commentId: string) => {
  await supabase.from('comments').delete().eq('id', commentId);
};

export const searchUsers = async (query: string, currentUserId: string): Promise<SearchProfile[]> => {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, handle, avatar_url')
    .ilike('handle', `%${query}%`)
    .neq('id', currentUserId)
    .limit(20);
  return data ?? [];
};

export const getFollowing = async (userId: string): Promise<Set<string>> => {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted');
  return new Set((data ?? []).map(f => f.following_id));
};

export const getPendingOutgoing = async (userId: string): Promise<Set<string>> => {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'pending');
  return new Set((data ?? []).map(f => f.following_id));
};

export type FollowStatus = 'none' | 'pending' | 'accepted';

export const getFollowStatus = async (myId: string, targetId: string): Promise<FollowStatus> => {
  const { data } = await supabase.from('follows').select('status').eq('follower_id', myId).eq('following_id', targetId).maybeSingle();
  if (!data) return 'none';
  return data.status as FollowStatus;
};

export const followUser = async (followerId: string, followingId: string) => {
  await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId, status: 'pending' });
  createNotification(followingId, 'follow_request', followerId);
};

export const getFollowerIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase.from('follows').select('follower_id').eq('following_id', userId).eq('status', 'accepted');
  return (data ?? []).map((r: any) => r.follower_id);
};

export interface FollowRequest {
  follower_id: string;
  profile: SearchProfile;
}

export const getPendingRequests = async (userId: string): Promise<FollowRequest[]> => {
  const { data } = await supabase.from('follows').select('follower_id').eq('following_id', userId).eq('status', 'pending');
  if (!data || data.length === 0) return [];
  const ids = data.map(r => r.follower_id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, handle, avatar_url').in('id', ids);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return data.map(r => ({ follower_id: r.follower_id, profile: profileMap[r.follower_id] })).filter(r => r.profile);
};

export const approveRequest = async (followerId: string, _followingId: string) => {
  await supabase.rpc('approve_follow_request', { p_follower_id: followerId });
};

export const denyRequest = async (followerId: string, _followingId: string) => {
  await supabase.rpc('deny_follow_request', { p_follower_id: followerId });
};

export const unfollowUser = async (followerId: string, followingId: string) => {
  await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
};

export const removeFollower = async (followerId: string, followingId: string) => {
  await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
};

export const getUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, handle, avatar_url, bio')
    .eq('id', userId)
    .maybeSingle();
  return data;
};

export const getFollowerList = async (userId: string): Promise<SearchProfile[]> => {
  const { data } = await supabase.from('follows').select('follower_id').eq('following_id', userId).eq('status', 'accepted');
  if (!data || data.length === 0) return [];
  const ids = data.map(r => r.follower_id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, handle, avatar_url').in('id', ids);
  return profiles ?? [];
};

export const getFollowingList = async (userId: string): Promise<SearchProfile[]> => {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted');
  if (!data || data.length === 0) return [];
  const ids = data.map(r => r.following_id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, handle, avatar_url').in('id', ids);
  return profiles ?? [];
};

export const getFollowerCounts = async (userId: string): Promise<{ followers: number; following: number }> => {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
  ]);
  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
};
