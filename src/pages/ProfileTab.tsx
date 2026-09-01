import React, { useEffect, useState, useCallback } from 'react';
import { Settings, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEntries, computeStats, Entry } from '@/lib/entries';
import { getFollowerCounts, getPendingRequests } from '@/lib/social';
import { supabase } from '@/integrations/supabase/client';
import ProfileTabs, { SubTab, SUB_TABS } from '@/components/ProfileTabs';
import { useSubTabSwipe } from '@/hooks/useSubTabSwipe';
import SettingsPage from '@/pages/SettingsPage';
import FollowRequestsPage from '@/pages/FollowRequestsPage';
import PullToRefresh from '@/components/PullToRefresh';
import FollowListSheet from '@/components/FollowListSheet';
import UserProfile from '@/pages/UserProfile';

interface Props {
  isActive: boolean;
  resetKey: number;
}

type View = 'profile' | 'user';

const ProfileTab = ({ isActive, resetKey }: Props) => {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [subTab, setSubTab] = useState<SubTab>('history');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [goal, setGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [followSheet, setFollowSheet] = useState<'followers' | 'following' | null>(null);
  const [view, setView] = useState<View>('profile');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    const [ents, c, reqs, profileRes] = await Promise.all([
      fetchEntries(user.id),
      getFollowerCounts(user.id),
      getPendingRequests(user.id),
      supabase.from('profiles').select('clean_day_goal').eq('id', user.id).maybeSingle(),
    ]);
    setEntries(ents);
    setCounts(c);
    setPendingCount(reqs.length);
    setGoal(profileRes.data?.clean_day_goal ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isActive) load(true);
    else { setFollowSheet(null); setShowRequests(false); setShowSettings(false); }
  }, [isActive]);

  useEffect(() => {
    if (resetKey > 0) { setView('profile'); setShowSettings(false); setShowRequests(false); setFollowSheet(null); }
  }, [resetKey]);

  const { streak, cleanDays, redDays } = computeStats(entries);
  const total = cleanDays + redDays;
  const fireRate = total > 0 ? Math.round((redDays / total) * 100) : 0;

  const handleProfileTap = (userId: string) => {
    setSelectedUserId(userId);
    setView('user');
  };

  // Must run before any early return: hooks have to be called in the same order
  // on every render, and the branch below skips the rest of the component.
  const subTabSwipe = useSubTabSwipe(SUB_TABS, subTab, setSubTab);

  if (view === 'user' && selectedUserId) {
    return <UserProfile userId={selectedUserId} onBack={() => setView('profile')} />;
  }

  return (
    <>
      <div className="flex flex-col h-full tab-bar-padding">
        <PullToRefresh onRefresh={() => load(true)}>
          <div className="px-5 pt-6 pb-6" {...subTabSwipe}>

            {/* Profile header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-card border border-border overflow-hidden flex-shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-wordmark text-2xl text-foreground">{profile?.name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-foreground text-lg leading-tight truncate">{profile?.name ?? '—'}</h2>
                <p className="text-sm text-muted-foreground">@{profile?.handle ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Follow requests button — only shows if pending > 0 */}
                {pendingCount > 0 && (
                  <button
                    onPointerDown={e => { e.preventDefault(); setShowRequests(true); }}
                    className="relative p-2 rounded-xl active:opacity-60 transition-opacity text-muted-foreground"
                  >
                    <UserPlus size={18} />
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-clean text-clean-foreground text-[9px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  </button>
                )}
                <button
                  onPointerDown={e => { e.preventDefault(); setShowSettings(true); }}
                  className="text-muted-foreground p-2 rounded-xl active:opacity-60 transition-opacity"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <p className="text-sm text-foreground/80 mb-4 -mt-2">{profile.bio}</p>
            )}

            {/* Follower counts */}
            <div className="flex gap-5 mb-8">
              <button
                onPointerDown={e => { e.preventDefault(); setFollowSheet('followers'); }}
                className="active:opacity-60 transition-opacity text-left"
              >
                <span className="font-semibold text-foreground text-sm">{counts.followers}</span>
                <span className="text-muted-foreground text-sm ml-1.5">Followers</span>
              </button>
              <button
                onPointerDown={e => { e.preventDefault(); setFollowSheet('following'); }}
                className="active:opacity-60 transition-opacity text-left"
              >
                <span className="font-semibold text-foreground text-sm">{counts.following}</span>
                <span className="text-muted-foreground text-sm ml-1.5">Following</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{loading ? '—' : streak}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Streak</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{loading ? '—' : (goal ?? '—')}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Goal Days</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-foreground">{loading ? '—' : `${fireRate}%`}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Fire Rate</div>
              </div>
            </div>

            {/* Sub-tabs */}
            {!loading && user && (
              <ProfileTabs
                entries={entries}
                profileUserId={user.id}
                subTab={subTab}
                onSubTabChange={setSubTab}
                currentUserId={user.id}
                canSeeContent={true}
              />
            )}

          </div>
        </PullToRefresh>
      </div>

      {showSettings && (
        <SettingsPage onClose={() => { setShowSettings(false); load(true); }} />
      )}

      {showRequests && (
        <FollowRequestsPage onClose={() => { setShowRequests(false); load(true); }} />
      )}

      {followSheet && user && (
        <FollowListSheet
          userId={user.id}
          type={followSheet}
          currentUserId={user.id}
          onClose={() => { setFollowSheet(null); load(true); }}
          onProfileTap={handleProfileTap}
        />
      )}
    </>
  );
};

export default ProfileTab;
