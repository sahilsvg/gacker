import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'follow_request'
  | 'follow_accepted'
  | 'like'
  | 'comment'
  | 'comment_like'
  | 'comment_reply'
  | 'mention_comment'
  | 'mention_entry'
  | 'streak_milestone'
  | 'goal_set'
  | 'goal_met';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
  actor_profile?: { name: string; handle: string; avatar_url: string | null };
}

export const createNotification = async (
  userId: string,
  type: NotificationType,
  actorId: string,
  data: Record<string, any> = {}
) => {
  if (userId === actorId) return; // never notify yourself
  await supabase.from('notifications').insert({ user_id: userId, type, actor_id: actorId, data });
};

export const createNotificationsForMany = async (
  userIds: string[],
  type: NotificationType,
  actorId: string,
  data: Record<string, any> = {}
) => {
  const targets = userIds.filter(id => id !== actorId);
  if (targets.length === 0) return;
  await supabase.from('notifications').insert(
    targets.map(uid => ({ user_id: uid, type, actor_id: actorId, data }))
  );
};

export const getNotifications = async (userId: string): Promise<AppNotification[]> => {
  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (!notifs || notifs.length === 0) return [];

  const actorIds = [...new Set(notifs.map((n: any) => n.actor_id).filter(Boolean))];
  let profileMap: Record<string, any> = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .in('id', actorIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  }

  return (notifs as any[]).map(n => ({
    ...n,
    actor_profile: n.actor_id ? profileMap[n.actor_id] : undefined,
  }));
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count ?? 0;
};

export const markAllRead = async (userId: string) => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
};
