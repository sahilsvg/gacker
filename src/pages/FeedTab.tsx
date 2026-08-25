import React, { useEffect, useState, useCallback, useRef } from 'react';
import { UserPlus, Bell } from 'lucide-react';
import { useTap } from '@/hooks/useTap';
import { useAuth } from '@/contexts/AuthContext';
import { getFeed, getMyActivity, FeedItem } from '@/lib/social';
import { getUnreadCount } from '@/lib/notifications';
import { supabase } from '@/integrations/supabase/client';
import FeedCard from '@/components/FeedCard';
import SearchUsers from '@/components/SearchUsers';
import UserProfile from '@/pages/UserProfile';
import NotificationsPage from '@/pages/NotificationsPage';
import PullToRefresh from '@/components/PullToRefresh';

interface Props {
  isActive: boolean;
  resetKey: number;
}

type SubTab = 'friends' | 'mine';

const FeedTab = ({ isActive, resetKey }: Props) => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('friends');
  const [friendsFeed, setFriendsFeed] = useState<FeedItem[]>([]);
  const [myFeed, setMyFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'feed' | 'search' | 'profile'>('feed');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const bellTap = useTap(() => { setShowNotifications(true); setUnreadCount(0); });
  const findFriendsTap = useTap(() => setView('search'));

  // Post a notification asked us to jump to: switch subtab, scroll it into
  // view, and open its thread — in the feed itself rather than a stacked sheet.
  const [focusPost, setFocusPost] = useState<{ id: string; openComments: boolean } | null>(null);
  const [missingPost, setMissingPost] = useState(false);

  const handleOpenPost = (id: string, _kind: 'entry' | 'goal_event', openComments: boolean) => {
    // Whichever feed holds it tells us which subtab to land on — no need to
    // know who owns the post.
    const inMine = myFeed.some(i => i.id === id);
    const inFriends = friendsFeed.some(i => i.id === id);
    if (!inMine && !inFriends) {
      // Older than the 50 rows each feed loads, or from someone since unfollowed.
      setMissingPost(true);
      setTimeout(() => setMissingPost(false), 2600);
      return;
    }
    setView('feed');
    setSubTab(inMine ? 'mine' : 'friends');
    setFocusPost({ id, openComments });
  };

  useEffect(() => {
    if (!focusPost) return;
    // Wait a frame for the subtab's cards to render before measuring.
    const t = setTimeout(() => {
      document.getElementById(`post-${focusPost.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    // Drop the focus once it has been honoured so the highlight fades and a
    // later re-render does not re-open a thread the user closed.
    const clear = setTimeout(() => setFocusPost(null), 2200);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [focusPost]);

  const load = useCallback(async (silent = false) => {
    if (!user || loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    const [friends, mine] = await Promise.all([
      getFeed(user.id),
      getMyActivity(user.id),
    ]);
    setFriendsFeed(friends);
    setMyFeed(mine);
    setLoading(false);
    loadingRef.current = false;
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isActive) { load(true); if (user) getUnreadCount(user.id).then(setUnreadCount); }
  }, [isActive]);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.id).then(setUnreadCount);
    const channel = supabase
      .channel('notif-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setUnreadCount(c => c + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (resetKey > 0) { setView('feed'); setSubTab('friends'); setShowNotifications(false); }
  }, [resetKey]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const handleProfileTap = (userId: string) => {
    setSelectedUserId(userId);
    setView('profile');
  };

  const handleUpdate = (id: string, iLiked: boolean, likeCount: number) => {
    setFriendsFeed(prev => prev.map(item => item.id === id ? { ...item, iLiked, likeCount } : item));
    setMyFeed(prev => prev.map(item => item.id === id ? { ...item, iLiked, likeCount } : item));
  };

  if (view === 'search') {
    return <SearchUsers onClose={() => { setView('feed'); load(true); }} onProfileTap={handleProfileTap} />;
  }

  if (view === 'profile' && selectedUserId) {
    return <UserProfile userId={selectedUserId} onBack={() => setView('feed')} />;
  }

  const activeFeed = subTab === 'friends' ? friendsFeed : myFeed;

  return (
    <>
    {showNotifications && (
      <NotificationsPage
        onClose={() => setShowNotifications(false)}
        onProfileTap={userId => { setSelectedUserId(userId); setView('profile'); }}
        onOpenPost={handleOpenPost}
      />
    )}
    {missingPost && (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[350] px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg">
        <p className="text-xs text-foreground">That post isn’t in your feed anymore.</p>
      </div>
    )}
    <div className="flex flex-col h-full tab-bar-padding">
      <PullToRefresh onRefresh={() => load(true)}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <h1 className="font-wordmark text-5xl text-foreground">The Feed</h1>
          <div className="flex items-center gap-2">
            {/* Bell */}
            <button
              {...bellTap.props}
              className="relative p-2 text-muted-foreground active:opacity-60 transition-opacity"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red text-red-foreground text-[9px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              {...findFriendsTap.props}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground transition-all active:scale-95"
            >
              <UserPlus size={15} />
              Find Friends
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex px-5 mb-4 gap-1 bg-card border border-border rounded-2xl mx-5 p-1">
          {(['friends', 'mine'] as SubTab[]).map(tab => (
            <button
              key={tab}
              onPointerDown={e => { e.preventDefault(); setSubTab(tab); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                subTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {tab === 'friends' ? 'Friends' : 'My Activity'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 pb-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-muted-foreground text-sm">Loading…</span>
            </div>
          )}

          {!loading && activeFeed.length === 0 && subTab === 'friends' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-5">
                <UserPlus size={24} className="text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Nothing here yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                Follow your friends to see their entries here.
              </p>
              <button
                onClick={() => setView('search')}
                className="mt-6 px-5 py-2.5 bg-clean text-clean-foreground rounded-xl text-sm font-semibold transition-all active:scale-95"
              >
                Find Friends
              </button>
            </div>
          )}

          {!loading && activeFeed.length === 0 && subTab === 'mine' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h3 className="font-semibold text-foreground mb-2">No entries yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                Log your first day to see it here.
              </p>
            </div>
          )}

          {!loading && activeFeed.map(item => (
            <div
              key={item.id}
              id={`post-${item.id}`}
              className={`rounded-2xl transition-shadow duration-500 ${
                focusPost?.id === item.id ? 'ring-2 ring-clean/60' : ''
              }`}
            >
              <FeedCard
                item={item}
                onProfileTap={handleProfileTap}
                onUpdate={handleUpdate}
                isTabActive={isActive}
                openComments={focusPost?.id === item.id && focusPost.openComments}
              />
            </div>
          ))}
        </div>
      </PullToRefresh>
    </div>
    </>
  );
};

export default FeedTab;
