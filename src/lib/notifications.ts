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
  | 'goal_25'
  | 'goal_50'
  | 'goal_75'
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

// Clears the dot on a single row, so tapping one notification does not silently
// mark the whole list read.
export const markNotificationRead = async (notificationId: string) => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
};

// Where a notification should navigate when tapped. `post` opens the entry or
// goal post behind it; `profile` opens the actor; null means nothing to open.
export const notifTarget = (
  n: AppNotification,
): { view: 'post'; kind: 'entry' | 'goal_event'; id: string; commentId?: string }
  | { view: 'profile'; id: string }
  | null => {
  const entryId = n.data?.entry_id;
  const goalEventId = n.data?.goal_event_id;
  const commentId = n.data?.comment_id;

  switch (n.type as NotificationType) {
    case 'like':
    case 'comment':
    case 'comment_like':
    case 'comment_reply':
    case 'mention_comment':
    case 'mention_entry':
      if (goalEventId) return { view: 'post', kind: 'goal_event', id: goalEventId, commentId };
      if (entryId) return { view: 'post', kind: 'entry', id: entryId, commentId };
      return null;

    case 'goal_set':
    case 'goal_25':
    case 'goal_50':
    case 'goal_75':
    case 'goal_met':
      // Rows written before goal_event_id was captured have nothing to open.
      return goalEventId ? { view: 'post', kind: 'goal_event', id: goalEventId } : null;

    case 'follow_request':
    case 'follow_accepted':
    case 'streak_milestone':
      return n.actor_id ? { view: 'profile', id: n.actor_id } : null;

    default:
      return null;
  }
};
