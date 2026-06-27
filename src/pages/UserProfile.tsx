import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, getFollowing, followUser, unfollowUser } from '@/lib/social';
import { fetchEntries, computeStats, formatDateKey, Entry } from '@/lib/entries';

const START_DATE = new Date(2026, 4, 13);

interface Props {
  userId: string;
  onBack: () => void;
}

const UserProfile = ({ userId, onBack }: Props) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ id: string; name: string; handle: string; avatar_url: string | null } | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(userId),
      fetchEntries(userId),
      getFollowing(user.id),
    ]).then(([prof, ents, following]) => {
      setProfile(prof);
      setEntries(ents);
      setIsFollowing(following.has(userId));
      setLoading(false);
    });
  }, [userId, user]);

  const handleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await unfollowUser(user.id, userId);
      setIsFollowing(false);
    } else {
      await followUser(user.id, userId);
      setIsFollowing(true);
    }
  };

  const { streak, cleanDays, redDays } = computeStats(entries);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const allDates: Date[] = [];
  for (let d = new Date(START_DATE); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDates.push(new Date(d));
  }
  const months: Record<string, Date[]> = {};
  allDates.forEach(d => {
    const key = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
    if (!months[key]) months[key] = [];
    months[key].push(new Date(d));
  });

  return (
    <div className="flex flex-col h-full tab-bar-padding" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Nav */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
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
                  onClick={handleFollow}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                    isFollowing ? 'bg-muted text-muted-foreground' : 'bg-clean text-clean-foreground'
                  }`}
                >
                  {isFollowing ? <><UserCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{streak}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Streak</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-clean">{cleanDays}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Clean</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="font-mono-stats text-2xl font-medium text-red">{redDays}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Red Days</div>
              </div>
            </div>

            {/* Calendar */}
            {isFollowing ? (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">History</h3>
                {Object.entries(months).reverse().map(([monthName, dates]) => {
                  const firstDow = dates[0].getDay();
                  const blanks = Array.from({ length: firstDow });
                  return (
                    <div key={monthName} className="mb-6">
                      <h4 className="text-sm font-semibold text-foreground mb-3">{monthName}</h4>
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
                        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {blanks.map((_, i) => <div key={`b${i}`} />)}
                        {dates.map(d => {
                          const key = formatDateKey(d);
                          const isFuture = d > today;
                          const entry = entries[key];
                          return (
                            <div key={key} className="flex flex-col items-center py-0.5">
                              <span className="text-[9px] text-muted-foreground mb-0.5">{d.getDate()}</span>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                isFuture ? 'bg-transparent'
                                  : !entry ? 'bg-muted/40 border border-border/40'
                                  : entry.clean ? 'bg-clean/90 text-clean-foreground shadow-[0_0_6px_hsl(142_71%_45%/0.4)]'
                                  : 'bg-red/90 text-red-foreground shadow-[0_0_6px_hsl(0_84%_60%/0.3)]'
                              }`}>
                                {!isFuture && (entry ? (entry.clean ? '✓' : '✗') : '?')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <p className="text-muted-foreground text-sm">Follow {profile?.name?.split(' ')[0]} to see their history.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
