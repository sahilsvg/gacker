import React from 'react';
import { Plus, Users, Crown, BarChart2, User } from 'lucide-react';
import { haptic } from '@/lib/haptics';

export type Tab = 'log' | 'feed' | 'leaderboard' | 'ganalytics' | 'profile';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: 'log', icon: <Plus size={22} strokeWidth={2.5} />, label: 'Log' },
  { id: 'feed', icon: <Users size={22} />, label: 'Feed' },
  { id: 'leaderboard', icon: <Crown size={22} />, label: 'Ranked' },
  { id: 'ganalytics', icon: <BarChart2 size={22} />, label: 'Ganalytics' },
  { id: 'profile', icon: <User size={22} />, label: 'Profile' },
];

const BottomNav = ({ active, onChange }: Props) => (
  <div
    className="fixed bottom-0 left-0 right-0 bg-card/95 border-t border-border backdrop-blur-xl tab-bar-height"
    style={{ zIndex: 100 }}
  >
    <div className="flex h-16">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => { haptic.light(); onChange(t.id); }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            active === t.id
              ? t.id === 'log'
                ? 'text-clean'
                : 'text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          <span className={`transition-transform ${active === t.id ? 'scale-110' : 'scale-100'}`}>
            {t.icon}
          </span>
          <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export default BottomNav;
