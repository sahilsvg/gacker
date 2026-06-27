import React from 'react';
import { BarChart2 } from 'lucide-react';
import { getEntries, computeStats } from '@/lib/storage';

const GanalyticsTab = () => {
  const entries = getEntries();
  const { streak, cleanDays, redDays } = computeStats(entries);
  const total = cleanDays + redDays;
  const fireRate = total > 0 ? Math.round((redDays / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full tab-bar-padding">
      <div className="flex-1 overflow-y-auto px-5 pt-16 pb-6">

        <div className="mb-8">
          <h1 className="font-wordmark text-5xl text-foreground mb-1">Ganalytics</h1>
          <p className="text-muted-foreground text-sm font-medium">Your performance, laid bare.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-mono-stats text-3xl font-medium text-clean mb-1">{streak}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Day Streak</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-mono-stats text-3xl font-medium text-clean mb-1">{cleanDays}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Clean Days</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-mono-stats text-3xl font-medium text-red mb-1">{redDays}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Red Days</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-mono-stats text-3xl font-medium text-foreground mb-1">{fireRate}%</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Fire Rate</div>
          </div>
        </div>

        {/* Clean rate bar */}
        {total > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex justify-between text-xs text-muted-foreground font-medium mb-3">
              <span>Clean vs Red</span>
              <span>{cleanDays} / {total} days</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-clean rounded-full transition-all"
                style={{ width: `${total > 0 ? (cleanDays / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Coming soon */}
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
