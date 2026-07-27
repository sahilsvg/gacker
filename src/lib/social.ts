import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/lib/notifications';

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
    .eq('follower_id', userId)
    .eq('status', 'accepted');

  const followingIds = (follows ?? []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  const [entriesRes, profilesRes] = await Promise.all([
    supabase.from('entries').select('*').in('user_id', followingIds).order('created_at', { ascending: false }).limit(50),
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

export const getMyActivity = async (userId: string): Promise<FeedItem[]> => {
  const [entriesRes, profileRes] = await Promise.all([
    supabase.from('entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, name, handle, avatar_url').eq('id', userId).maybeSingle(),
  ]);

  const entries = entriesRes.data ?? [];
  const profile = profileRes.data;
  if (entries.length === 0) return [];

  const entryIds = entries.map(e => e.id);
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('likes').select('entry_id, user_id').in('entry_id', entryIds),
    supabase.from('comments').select('entry_id').in('entry_id', entryIds),
  ]);

  const likes = likesRes.data ?? [];
  const comments = commentsRes.data ?? [];

  return entries.map(entry => ({
    ...entry,
    profile,
    likeCount: likes.filter(l => l.entry_id === entry.id).length,
    iLiked: likes.some(l => l.entry_id === entry.id && l.user_id === userId),
    commentCount: comments.filter(c => c.entry_id === entry.id).length,
  }));
};

export const toggleLike = async (userId: string, entryId: string, iLiked: boolean, entryOwnerId?: string) => {
  if (iLiked) {
    await supabase.from('likes').delete().eq('user_id', userId).eq('entry_id', entryId);
  } else {
    await supabase.from('likes').insert({ user_id: userId, entry_id: entryId });
    if (entryOwnerId) createNotification(entryOwnerId, 'like', userId, { entry_id: entryId });
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

export const postComment = async (userId: string, entryId: string, body: string, entryOwnerId?: string): Promise<string | null> => {
  const { error } = await supabase.from('comments').insert({ user_id: userId, entry_id: entryId, body });
  if (!error && entryOwnerId) createNotification(entryOwnerId, 'comment', userId, { entry_id: entryId, body: body.slice(0, 80) });
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
    .select('id, name, handle, avatar_url')
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
