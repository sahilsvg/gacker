import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, markAllRead, markNotificationRead, notifTarget, AppNotification, NotificationType } from '@/lib/notifications';
import { timeAgo } from '@/lib/timeAgo';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { useTapList } from '@/hooks/useTap';
import PostDetailSheet from '@/components/PostDetailSheet';

interface Props {
  onClose: () => void;
  /** Opening a profile from a notification hands off to the parent view. */
  onProfileTap?: (userId: string) => void;
}

// Likes and comments can land on a daily entry or on a goal post; the payload
// says which. Keeps "entry" as the word for daily logs rather than flattening
// everything to "post".
const subject = (n: AppNotification) => (n.data?.goal_event_id ? 'goal post' : 'entry');

const notifText = (n: AppNotification): string => {
  const handle = n.actor_profile?.handle ? `@${n.actor_profile.handle}` : 'Someone';
  switch (n.type as NotificationType) {
    case 'follow_request':
      return `${handle} requested to follow you`;
    case 'follow_accepted':
      return `${handle} accepted your follow request`;
    case 'like':
      return `${handle} liked your ${subject(n)}`;
    case 'comment':
      return n.data?.body
        ? `${handle} commented: "${n.data.body}"`
        : `${handle} commented on your ${subject(n)}`;
    case 'comment_like':
      return `${handle} liked your comment`;
    case 'comment_reply':
      return n.data?.body
        ? `${handle} replied: "${n.data.body}"`
        : `${handle} replied to your comment`;
    case 'mention_comment':
      return n.data?.body
        ? `${handle} mentioned you: "${n.data.body}"`
        : `${handle} mentioned you in a comment`;
    case 'mention_entry':
      return `${handle} mentioned you in a post`;
    case 'goal_set': {
      const days = n.data?.goal_days;
      return `${handle} just set a ${days} day goal!`;
    }
    case 'goal_25': {
      const days = n.data?.goal_days;
      return `${handle} is a quarter of the way to their ${days} day goal`;
    }
    case 'goal_50': {
      const days = n.data?.goal_days;
      return `${handle} is halfway to their ${days} day goal`;
    }
    case 'goal_75': {
      const days = n.data?.goal_days;
      return `${handle} is three quarters of the way to their ${days} day goal`;
    }
    case 'goal_met': {
      const days = n.data?.goal_days;
      return `${handle} just hit their ${days} day goal! 🎉`;
    }
    case 'streak_milestone': {
      const count = n.data?.streak_count;
      const label = count >= 365 ? '1 year' : count >= 30 ? `${Math.floor(count / 30)} month${count >= 60 ? 's' : ''}` : `${count} days`;
      return `${handle} hit a ${label} clean streak!`;
    }
    default:
      return 'New notification';
  }
};

const Avatar = ({ n }: { n: AppNotification }) => {
  const p = n.actor_profile;
  if (!p) return (
    <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
      <Bell size={16} className="text-muted-foreground" />
    </div>
  );
  return p.avatar_url
    ? <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
    : <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <span className="font-wordmark text-lg text-foreground">{p.name?.[0]?.toUpperCase()}</span>
      </div>;
};

const NotificationsPage = ({ onClose, onProfileTap }: Props) => {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPost, setOpenPost] = useState<{ id: string; kind: 'entry' | 'goal_event'; openComments: boolean } | null>(null);
  const { onTouchStart, onTouchEnd } = useSwipeToDismiss(onClose);
  const tapList = useTapList();

  // Comment-ish notifications drop you straight into the thread.
  const commentTypes = new Set(['comment', 'comment_like', 'comment_reply', 'mention_comment']);

  const handleNotifTap = (n: AppNotification) => {
    // Clear this row's dot regardless of whether it opens anything.
    if (!n.read) {
      setNotifs(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id);
    }
    const target = notifTarget(n);
    if (!target) return;
    if (target.view === 'profile') {
      onProfileTap?.(target.id);
      onClose();
      return;
    }
    setOpenPost({ id: target.id, kind: target.kind, openComments: commentTypes.has(n.type) });
  };

  useEffect(() => {
    if (!user) return;
    getNotifications(user.id).then(data => {
      setNotifs(data);
      setLoading(false);
      markAllRead(user.id);
    });
  }, [user]);

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col z-[300] animate-slide-up"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header — swipe down here to dismiss */}
      <div className="flex items-center px-5 pt-6 pb-4 border-b border-border" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          onPointerDown={e => { e.preventDefault(); onClose(); }}
          className="flex items-center gap-1.5 text-muted-foreground text-sm active:opacity-60 transition-opacity py-3 pr-4 -ml-1"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-semibold text-foreground text-base">Notifications</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-muted-foreground text-sm text-center py-12">Loading…</p>
        )}
        {!loading && notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 px-8 text-center">
            <Bell size={32} className="text-muted-foreground/40 mb-2" />
            <p className="text-foreground font-semibold text-sm">Nothing here yet</p>
            <p className="text-muted-foreground text-xs">Follow requests, likes, comments, and streak milestones will show up here.</p>
          </div>
        )}
        <div className="divide-y divide-border/50">
          {notifs.map(n => (
            <div
              key={n.id}
              {...tapList(n.id, () => handleNotifTap(n))}
              className={`flex items-start gap-3 px-5 py-4 transition-colors select-none ${
                !n.read ? 'bg-clean/5' : ''
              } ${notifTarget(n) ? 'active:bg-muted/40 cursor-pointer' : ''}`}
            >
              <Avatar n={n} />
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-foreground leading-snug">{notifText(n)}</p>
                <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-clean flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {openPost && (
        <PostDetailSheet
          id={openPost.id}
          kind={openPost.kind}
          openComments={openPost.openComments}
          onClose={() => setOpenPost(null)}
          onProfileTap={userId => { setOpenPost(null); onProfileTap?.(userId); onClose(); }}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
