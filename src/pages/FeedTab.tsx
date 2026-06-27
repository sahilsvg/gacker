import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getFeed, FeedItem } from '@/lib/social';
import FeedCard from '@/components/FeedCard';
import SearchUsers from '@/components/SearchUsers';
import UserProfile from '@/pages/UserProfile';

const FeedTab = () => {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'feed' | 'search' | 'profile'>('feed');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getFeed(user.id);
    setFeed(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleProfileTap = (userId: string) => {
    setSelectedUserId(userId);
    setView('profile');
  };

  const handleUpdate = (id: string, iLiked: boolean, likeCount: number) => {
    setFeed(prev => prev.map(item => item.id === id ? { ...item, iLiked, likeCount } : item));
  };

  if (view === 'search') {
    return <SearchUsers onClose={() => setView('feed')} onProfileTap={handleProfileTap} />;
  }

  if (view === 'profile' && selectedUserId) {
    return <UserProfile userId={selectedUserId} onBack={() => setView('feed')} />;
  }

  return (
    <div className="flex flex-col h-full tab-bar-padding">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-16 pb-4">
          <h1 className="font-wordmark text-5xl text-foreground">The Feed</h1>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-muted-foreground active:text-foreground transition-colors">
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setView('search')}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground transition-all active:scale-95"
            >
              <UserPlus size={15} />
              Find Friends
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="px-5 pb-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-muted-foreground text-sm">Loading feed…</span>
            </div>
          )}

          {!loading && feed.length === 0 && (
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

          {feed.map(item => (
            <FeedCard
              key={item.id}
              item={item}
              onProfileTap={handleProfileTap}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedTab;
