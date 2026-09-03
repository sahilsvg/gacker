import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getLeaderboard, LeaderboardEntry } from '@/lib/leaderboard';
import { useTapList } from '@/hooks/useTap';
import { haptic } from '@/lib/haptics';
import PullToRefresh from '@/components/PullToRefresh';
import UserProfile from '@/pages/UserProfile';

interface Props {
  isActive: boolean;
  resetKey: number;
}

const Avatar = ({ entry }: { entry: LeaderboardEntry }) => (
  entry.avatar_url
    ? <img src={entry.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
    : <div className="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <span className="font-wordmark text-xl text-foreground">{entry.name?.[0]?.toUpperCase()}</span>
      </div>
);

// Top three get a visual cue instead of a bare number, same idea as a podium.
const RankBadge = ({ rank }: { rank: number }) => {
  if (rank > 3) {
    return <span className="w-7 text-center text-sm font-semibold text-muted-foreground">{rank}</span>;
  }
  const color = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : 'text-amber-600';
  return (
    <span className={`w-7 flex items-center justify-center ${color}`}>
      <Crown size={18} fill="currentColor" />
    </span>
  );
};

const LeaderboardTab = ({ isActive, resetKey }: Props) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'profile'>('list');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const tapList = useTapList();

  const load = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    try {
      setEntries(await getLeaderboard());
    } finally {
      // finally, not after the try body: a throw here must not leave the
      // screen stuck on "Loading…" forever.
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isActive) load(true);
  }, [isActive, load]);

  useEffect(() => {
    if (resetKey > 0) setView('list');
  }, [resetKey]);

  // Ranking updates the moment anyone's fire rate would change -- a log
  // anywhere moves the whole board, not just the logger's own row.
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleProfileTap = (userId: string) => {
    setSelectedUserId(userId);
    setView('profile');
  };

  if (view === 'profile' && selectedUserId) {
    return <UserProfile userId={selectedUserId} onBack={() => setView('list')} />;
  }

  return (
    <div className="flex flex-col h-full tab-bar-padding">
      <PullToRefresh onRefresh={() => load(true)}>
        <div className="px-5 pt-6 pb-6">
          <h1 className="font-wordmark text-5xl text-foreground mb-1">Leaderboard</h1>
          <p className="text-muted-foreground text-sm font-medium mb-6">
            Lowest fire rate wins. 14+ days logged, active within 2 days.
          </p>

          {loading && (
            <p className="text-muted-foreground text-sm text-center py-12">Loading…</p>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Crown size={28} className="text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Nothing to rank yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                Once people start logging, this fills in on its own.
              </p>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map(entry => {
                const isMe = entry.user_id === user?.id;
                return (
                  <div
                    key={entry.user_id}
                    {...tapList(entry.user_id, () => { haptic.light(); handleProfileTap(entry.user_id); })}
                    className={`flex items-center gap-3 rounded-2xl p-3 select-none cursor-pointer active:opacity-70 transition-opacity ${
                      isMe ? 'bg-clean/10 border border-clean/30' : 'bg-card border border-border'
                    }`}
                  >
                    <RankBadge rank={entry.rank} />
                    <Avatar entry={entry} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {entry.name}{isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">@{entry.handle}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono-stats text-lg font-medium text-foreground">{entry.fire_rate}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">fire rate</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
};

export default LeaderboardTab;
