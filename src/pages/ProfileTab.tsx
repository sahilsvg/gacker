import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEntries, computeStats, formatDateKey, Entry } from '@/lib/entries';

const START_DATE = new Date(2026, 4, 13);

const ProfileTab = () => {
  const { user, profile, signOut } = useAuth();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchEntries(user.id).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, [user]);

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
    <div className="flex flex-col h-full tab-bar-padding">
      <div className="flex-1 overflow-y-auto px-5 pt-16 pb-6">

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
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
          <button onClick={signOut} className="text-muted-foreground p-2 rounded-xl hover:text-foreground transition-colors">
            <LogOut size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="font-mono-stats text-2xl font-medium text-clean">{loading ? '—' : streak}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Streak</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="font-mono-stats text-2xl font-medium text-clean">{loading ? '—' : cleanDays}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Clean</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="font-mono-stats text-2xl font-medium text-red">{loading ? '—' : redDays}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Red Days</div>
          </div>
        </div>

        {/* Calendar */}
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
                        isFuture
                          ? 'bg-transparent'
                          : !entry
                            ? 'bg-muted/40 border border-border/40'
                            : entry.clean
                              ? 'bg-clean/90 text-clean-foreground shadow-[0_0_6px_hsl(142_71%_45%/0.4)]'
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

      </div>
    </div>
  );
};

export default ProfileTab;
