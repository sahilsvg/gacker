import React, { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEntries, computeStats, Entry } from '@/lib/entries';

const GanalyticsTab = ({ resetKey: _ }: { resetKey: number }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchEntries(user.id).then(data => { setEntries(data); setLoading(false); });
  }, [user]);

  const { streak, cleanDays, redDays } = computeStats(entries);
  const total = cleanDays + redDays;
  const fireRate = total > 0 ? Math.round((redDays / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full tab-bar-padding">
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">

        <div className="mb-8">
          <h1 className="font-wordmark text-5xl text-foreground mb-1">Ganalytics</h1>
          <p className="text-muted-foreground text-sm font-medium">Your performance, laid bare.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { value: streak, label: 'Day Streak', color: 'text-clean' },
            { value: cleanDays, label: 'Clean Days', color: 'text-clean' },
            { value: redDays, label: 'Red Days', color: 'text-red' },
            { value: `${fireRate}%`, label: 'Fire Rate', color: 'text-foreground' },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-5">
              <div className={`font-mono-stats text-3xl font-medium mb-1 ${color}`}>
                {loading ? '—' : value}
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {total > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex justify-between text-xs text-muted-foreground font-medium mb-3">
              <span>Clean vs Red</span>
              <span>{cleanDays} / {total} days</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-clean rounded-full transition-all duration-700"
                style={{ width: `${(cleanDays / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <BarChart2 size={18} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">More coming soon</span>
          </div>
          <ul className="space-y-2">
            {['Weekly & monthly trends', 'Goal tracking', 'Predicted next red day', 'Location heat map'].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default GanalyticsTab;
