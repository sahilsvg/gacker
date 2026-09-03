import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, getFollowStatus, FollowStatus, followUser, unfollowUser, getFollowerCounts } from '@/lib/social';
import { fetchEntries, computeStats, Entry } from '@/lib/entries';
import ProfileTabs, { SubTab, SUB_TABS } from '@/components/ProfileTabs';
import FollowListSheet from '@/components/FollowListSheet';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
  onBack: () => void;
}

const UserProfile = ({ userId, onBack }: Props) => {
  const { user } = useAuth();
  const isOwnProfile = user?.id === userId;
  const [profile, setProfile] = useState<{ id: string; name: string; handle: string; avatar_url: string | null } | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('history');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [goal, setGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [followSheet, setFollowSheet] = useState<'followers' | 'following' | null>(null);

  const canSeeContent = isOwnProfile || followStatus === 'accepted';

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(userId),
      fetchEntries(userId),
      getFollowStatus(user.id, userId),
      getFollowerCounts(userId),
      supabase.from('profiles').select('clean_day_goal').eq('id', userId).maybeSingle(),
    ]).then(([prof, ents, status, c, profileRes]) => {
      setProfile(prof);
      setEntries(ents);
      setFollowStatus(status);
      setCounts(c);
      setGoal((profileRes as any).data?.clean_day_goal ?? null);
      setLoading(false);
    });
  }, [userId, user]);

  const handleFollow = async () => {
    if (!user) return;
    if (followStatus === 'accepted') {
      await unfollowUser(user.id, userId);
      setFollowStatus('none');
      setCounts(c => ({ ...c, followers: Math.max(0, c.followers - 1) }));
    } else if (followStatus === 'pending') {
      await unfollowUser(user.id, userId);
      setFollowStatus('none');
    } else {
      await followUser(user.id, userId);
      setFollowStatus('pending');
    }
  };

  const { streak, cleanDays, redDays } = computeStats(entries);
  const total = cleanDays + redDays;
  const fireRate = total > 0 ? Math.round((redDays / total) * 100) : 0;

  const handleProfileTap = (tappedId: string) => {
    // If they tap their own profile from within this list, go back
    if (tappedId === userId) { setFollowSheet(null); return; }
    // Otherwise navigate — parent handles this by re-rendering UserProfile with new userId
    // For now close sheet; full navigation handled by the parent stack
    setFollowSheet(null);
  };


  return (
    <div className="flex flex-col h-full tab-bar-padding animate-slide-in-right">
      {/* Nav */}
      <div className="flex items-center gap-3 px-5 pb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground text-sm py-3 pr-4 -ml-1">
          <ArrowLeft size={20} /> Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-muted-foreground text-sm">Loading…</span>
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-card border border-border overflow-hidden flex-shrink-0">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <span className="font-wordmark text-2xl text-foreground">{profile?.name?.[0]?.toUpperCase()}</span>
                    </div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-foreground text-lg leading-tight truncate">{profile?.name}</h2>
                <p className="text-sm text-muted-foreground">@{profile?.handle}</p>
              </div>
              {!isOwnProfile && (
                <button
                  onPointerDown={e => { e.preventDefault(); handleFollow(); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                    followStatus === 'accepted'
                      ? 'bg-muted text-muted-foreground'
                      : followStatus === 'pending'
                      ? 'bg-muted/60 text-muted-foreground border border-border'
                      : 'bg-clean text-clean-foreground'
                  }`}
                >
                  {followStatus === 'accepted' && <><UserCheck size={15} /> Following</>}
                  {followStatus === 'pending' && <><Clock size={15} /> Requested</>}
                  {followStatus === 'none' && <><UserPlus size={15} /> Follow</>}
                </button>
              )}
            </div>

            {/* Bio */}
            {profile?.bio && (
              <p className="text-sm text-foreground/80 mb-4 -mt-2 font-sf-pro">{profile.bio}</p>
            )}

            {/* Follower counts — tappable only if accepted or own profile */}
            <div className="flex gap-5 mb-6">
              <button
                onPointerDown={e => { e.preventDefault(); if (canSeeContent) setFollowSheet('followers'); }}
                className={`text-left ${canSeeContent ? 'active:opacity-60 transition-opacity' : 'cursor-default'}`}
              >
                <span className="font-semibold text-foreground text-sm">{counts.followers}</span>
                <span className="text-muted-foreground text-sm ml-1.5">Followers</span>
              </button>
              <button
                onPointerDown={e => { e.preventDefault(); if (canSeeContent) setFollowSheet('following'); }}
                className={`text-left ${canSeeContent ? 'active:opacity-60 transition-opacity' : 'cursor-default'}`}
              >
                <span className="font-semibold text-foreground text-sm">{counts.following}</span>
                <span className="text-muted-foreground text-sm ml-1.5">Following</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{canSeeContent ? streak : '—'}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Streak</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{canSeeContent ? (goal ?? '—') : '—'}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Goal Days</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-foreground">{canSeeContent ? `${fireRate}%` : '—'}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Fire Rate</div>
              </div>
            </div>

            {/* Sub-tabs */}
            {user && (
              <ProfileTabs
                entries={entries}
                profileUserId={userId}
                subTab={subTab}
                onSubTabChange={setSubTab}
                currentUserId={user.id}
                canSeeContent={canSeeContent}
                lockedMessage={
                  followStatus === 'pending'
                    ? `Follow request sent. You'll see ${profile?.name?.split(' ')[0]}'s history once they approve it.`
                    : `Follow ${profile?.name?.split(' ')[0]} to see their history.`
                }
              />
            )}
          </>
        )}
      </div>

      {followSheet && user && (
        <FollowListSheet
          userId={userId}
          type={followSheet}
          currentUserId={user.id}
          onClose={() => setFollowSheet(null)}
          onProfileTap={handleProfileTap}
        />
      )}
    </div>
  );
};

export default UserProfile;
