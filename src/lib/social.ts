import { supabase } from '@/integrations/supabase/client';

export interface FeedItem {
  id: string;
  user_id: string;
  date: string;
  clean: boolean;
  notes: string | null;
  created_at: string;
  profile: { id: string; name: string; handle: string; avatar_url: string | null };
  likeCount: number;
  iLiked: boolean;
  commentCount: number;
}

export interface Comment {
  id: string;
  user_id: string;
  entry_id: string;
  body: string;
  created_at: string;
  profile: { name: string; handle: string; avatar_url: string | null };
}

export interface SearchProfile {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
}

export const getFeed = async (userId: string): Promise<FeedItem[]> => {
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = (follows ?? []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  const [entriesRes, profilesRes] = await Promise.all([
    supabase.from('entries').select('*').in('user_id', followingIds).order('date', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, name, handle, avatar_url').in('id', followingIds),
  ]);

  const entries = entriesRes.data ?? [];
  const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p]));
  const entryIds = entries.map(e => e.id);
  if (entryIds.length === 0) return [];

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('likes').select('entry_id, user_id').in('entry_id', entryIds),
    supabase.from('comments').select('entry_id').in('entry_id', entryIds),
  ]);

  const likes = likesRes.data ?? [];
  const comments = commentsRes.data ?? [];

  return entries.map(entry => ({
    ...entry,
    profile: profileMap[entry.user_id],
    likeCount: likes.filter(l => l.entry_id === entry.id).length,
    iLiked: likes.some(l => l.entry_id === entry.id && l.user_id === userId),
    commentCount: comments.filter(c => c.entry_id === entry.id).length,
  }));
};

export const toggleLike = async (userId: string, entryId: string, iLiked: boolean) => {
  if (iLiked) {
    await supabase.from('likes').delete().eq('user_id', userId).eq('entry_id', entryId);
  } else {
    await supabase.from('likes').insert({ user_id: userId, entry_id: entryId });
  }
};

export const getComments = async (entryId: string): Promise<Comment[]> => {
  const { data: comments } = await supabase
    .from('comments')
    .select('id, user_id, entry_id, body, created_at')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });

  if (!comments || comments.length === 0) return [];

  const userIds = [...new Set(comments.map(c => c.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, handle, avatar_url')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return comments.map(c => ({ ...c, profile: profileMap[c.user_id] }));
};

export const postComment = async (userId: string, entryId: string, body: string): Promise<string | null> => {
  const { error } = await supabase.from('comments').insert({ user_id: userId, entry_id: entryId, body });
  return error?.message ?? null;
};

export const getLikes = async (entryId: string): Promise<SearchProfile[]> => {
  const { data: likes } = await supabase.from('likes').select('user_id').eq('entry_id', entryId);
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
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  return new Set((data ?? []).map(f => f.following_id));
};

export const followUser = async (followerId: string, followingId: string) => {
  await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
};

export const unfollowUser = async (followerId: string, followingId: string) => {
  await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
};

export const getUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, handle, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  return data;
};
