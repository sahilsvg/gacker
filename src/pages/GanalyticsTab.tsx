import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Target, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEntries, computeStats, Entry } from '@/lib/entries';
import { supabase } from '@/integrations/supabase/client';
import { haptic } from '@/lib/haptics';

// ─── Goal Picker Sheet ───────────────────────────────────────────────────────

const DAYS = Array.from({ length: 200 }, (_, i) => i + 1);
const ITEM_H = 52; // px per row

const GoalPicker = ({ current, onSave, onClose }: {
  current: number | null;
  onSave: (days: number) => void;
  onClose: () => void;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(current ?? 30);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };

  // Scroll-snap via native momentum — track which item is centred
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    setSelected(DAYS[Math.min(idx, DAYS.length - 1)]);
  };

  // Scroll to initial position without animation
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = DAYS.indexOf(selected);
    el.scrollTop = idx * ITEM_H;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onPointerDown={handleClose}
      />

      {/* Card */}
      <div
        className={`relative w-full bg-card rounded-t-3xl px-6 pt-5 pb-10 flex flex-col items-center gap-6 ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-border" />

        <div className="flex items-center justify-between w-full">
          <h3 className="font-semibold text-foreground text-lg">Set your goal</h3>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground p-2 -mr-2">
            <X size={18} />
          </button>
        </div>

        <p className="text-muted-foreground text-sm -mt-3 w-full">How many clean days are you aiming for?</p>

        {/* Scroll wheel */}
        <div className="relative w-full" style={{ height: ITEM_H * 5 }}>
          {/* Selection highlight */}
          <div
            className="absolute left-0 right-0 rounded-2xl bg-clean/10 border border-clean/20 pointer-events-none z-10"
            style={{ top: ITEM_H * 2, height: ITEM_H }}
          />

          {/* Fade top */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-card to-transparent pointer-events-none z-10" />
          {/* Fade bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent pointer-events-none z-10" />

          <div
            ref={listRef}
            onScroll={onScroll}
            className="h-full overflow-y-scroll"
            style={{
              scrollSnapType: 'y mandatory',
              WebkitOverflowScrolling: 'touch',
              // hide scrollbar
              scrollbarWidth: 'none',
            }}
          >
            {/* Padding so first/last items can centre */}
            <div style={{ height: ITEM_H * 2 }} />
            {DAYS.map(d => (
              <div
                key={d}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
                className="flex items-center justify-center"
              >
                <span className={`font-mono-stats text-2xl transition-all duration-150 ${
                  d === selected ? 'text-clean font-semibold scale-110' : 'text-muted-foreground/50 scale-95'
                }`}>
                  {d} {d === 1 ? 'day' : 'days'}
                </span>
              </div>
            ))}
            <div style={{ height: ITEM_H * 2 }} />
          </div>
        </div>

        <button
          onPointerDown={e => { e.preventDefault(); haptic.medium(); onSave(selected); handleClose(); }}
          className="w-full h-14 rounded-2xl bg-clean text-clean-foreground font-semibold text-base active:scale-95 transition-all"
        >
          Set Goal — {selected} {selected === 1 ? 'day' : 'days'}
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
};

// ─── Main Tab ────────────────────────────────────────────────────────────────

const GanalyticsTab = ({ resetKey: _ }: { resetKey: number }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchEntries(user.id),
      supabase.from('profiles').select('clean_day_goal').eq('id', user.id).maybeSingle(),
    ]).then(([data, profileRes]) => {
      setEntries(data);
      setGoal(profileRes.data?.clean_day_goal ?? null);
      setLoading(false);
    });
  }, [user]);

  const handleSaveGoal = async (days: number) => {
    setGoal(days);
    if (!user) return;
    await supabase.from('profiles').update({ clean_day_goal: days }).eq('id', user.id);
  };

  const { streak, cleanDays, redDays } = computeStats(entries);
  const total = cleanDays + redDays;
  const fireRate = total > 0 ? Math.round((redDays / total) * 100) : 0;
  const goalProgress = goal && cleanDays > 0 ? Math.min(cleanDays / goal, 1) : 0;
  const daysLeft = goal ? Math.max(goal - cleanDays, 0) : null;

  return (
    <>
      <div className="flex flex-col h-full tab-bar-padding">
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">

          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="font-wordmark text-5xl text-foreground mb-1">Ganalytics</h1>
              <p className="text-muted-foreground text-sm font-medium">Your performance, laid bare.</p>
            </div>
            <button
              onPointerDown={e => { e.preventDefault(); haptic.light(); setShowPicker(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm font-medium text-foreground active:opacity-60 transition-opacity flex-shrink-0"
            >
              <Target size={14} className="text-clean" />
              {goal ? `${goal}d goal` : 'Set goal'}
            </button>
          </div>

          {/* Goal progress card */}
          {goal && (
            <div className="bg-card border border-border rounded-2xl p-5 mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Goal Progress</span>
                <span className="text-xs text-muted-foreground">
                  {loading ? '—' : cleanDays} / {goal} days
                  {daysLeft !== null && daysLeft > 0 && (
                    <span className="text-muted-foreground/60"> · {daysLeft} to go</span>
                  )}
                  {daysLeft === 0 && <span className="text-clean font-semibold"> · Complete!</span>}
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-clean rounded-full transition-all duration-700"
                  style={{ width: `${goalProgress * 100}%` }}
                />
              </div>
              {daysLeft === 0 && (
                <p className="text-clean text-xs font-medium mt-2 text-center">🎉 You hit your goal!</p>
              )}
            </div>
          )}

          {/* Stats grid */}
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

          {/* Clean vs Red bar */}
          {total > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
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

        </div>
      </div>

      {showPicker && (
        <GoalPicker
          current={goal}
          onSave={handleSaveGoal}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
};

export default GanalyticsTab;
