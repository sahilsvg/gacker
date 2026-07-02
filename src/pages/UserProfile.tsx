import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, getFollowStatus, FollowStatus, followUser, unfollowUser, getFollowerCounts } from '@/lib/social';
import { fetchEntries, computeStats, Entry } from '@/lib/entries';
import CalendarView from '@/components/CalendarView';
import EntryDetailSheet from '@/components/EntryDetailSheet';

interface Props {
  userId: string;
  onBack: () => void;
}

const UserProfile = ({ userId, onBack }: Props) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ id: string; name: string; handle: string; avatar_url: string | null } | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [entryDetail, setEntryDetail] = useState<{ dateKey: string; entry: Entry } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(userId),
      fetchEntries(userId),
      getFollowStatus(user.id, userId),
      getFollowerCounts(userId),
    ]).then(([prof, ents, status, c]) => {
      setProfile(prof);
      setEntries(ents);
      setFollowStatus(status);
      setCounts(c);
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

  return (
    <div className="flex flex-col h-full tab-bar-padding animate-slide-in-right">
      {/* Nav */}
      <div className="flex items-center gap-3 px-5 pb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <ArrowLeft size={16} /> Back
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
              {user?.id !== userId && (
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

            {/* Follower counts */}
            <div className="flex gap-5 mb-6">
              <div>
                <span className="font-semibold text-foreground text-sm">{counts.followers}</span>
                <span className="text-muted-foreground text-sm ml-1.5">Followers</span>
              </div>
              <div>
                <span className="font-semibold text-foreground text-sm">{counts.following}</span>
                <span className="text-muted-foreground text-sm ml-1.5">Following</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{followStatus === 'accepted' ? streak : '—'}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Streak</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{followStatus === 'accepted' ? cleanDays : '—'}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Clean</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-red">{followStatus === 'accepted' ? redDays : '—'}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Red Days</div>
              </div>
            </div>

            {/* Calendar — only shown to accepted followers */}
            {followStatus === 'accepted' ? (
              <CalendarView
                entries={entries}
                onDayTap={(dateKey, entry) => setEntryDetail({ dateKey, entry })}
              />
            ) : (
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                {followStatus === 'pending' ? (
                  <p className="text-muted-foreground text-sm">Follow request sent. You'll see {profile?.name?.split(' ')[0]}'s history once they approve it.</p>
                ) : (
                  <p className="text-muted-foreground text-sm">Follow {profile?.name?.split(' ')[0]} to see their history.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {entryDetail && (
        <EntryDetailSheet
          dateKey={entryDetail.dateKey}
          entry={entryDetail.entry}
          onClose={() => setEntryDetail(null)}
        />
      )}
    </div>
  );
};

export default UserProfile;
