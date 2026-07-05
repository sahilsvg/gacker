import React, { useEffect, useState, useCallback, useRef } from 'react';
import { UserPlus, Bell } from 'lucide-react';
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
    {showNotifications && <NotificationsPage onClose={() => setShowNotifications(false)} />}
    <div className="flex flex-col h-full tab-bar-padding">
      <PullToRefresh onRefresh={() => load(true)}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <h1 className="font-wordmark text-5xl text-foreground">The Feed</h1>
          <div className="flex items-center gap-2">
            {/* Bell */}
            <button
              onPointerDown={e => { e.preventDefault(); setShowNotifications(true); setUnreadCount(0); }}
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
              onPointerDown={e => { e.preventDefault(); setView('search'); }}
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
            <FeedCard
              key={item.id}
              item={item}
              onProfileTap={handleProfileTap}
              onUpdate={handleUpdate}
              isTabActive={isActive}
            />
          ))}
        </div>
      </PullToRefresh>
    </div>
    </>
  );
};

export default FeedTab;
