import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateKey, upsertEntry, fetchEntries, computeStats, Entry } from '@/lib/entries';
import { getFollowerIds } from '@/lib/social';
import { createNotificationsForMany } from '@/lib/notifications';
import SongPicker, { SongSelection } from '@/components/SongPicker';
import DatePickerSheet from '@/components/DatePickerSheet';

const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 60, 90, 180, 365]);


const triggerCleanConfetti = () => {
  const colors = ['#22C55E', '#16a34a', '#86efac', '#ffffff'];
  const end = Date.now() + 1000;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, startVelocity: 50, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, startVelocity: 50, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const formatDisplayDate = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();
  const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return isToday ? label : label;
};

const LogTab = ({ resetKey: _, isActive }: { resetKey: number; isActive?: boolean }) => {
  const { user } = useAuth();
  const todayKey = formatDateKey(new Date());

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [notes, setNotes] = useState('');
  const [song, setSong] = useState<SongSelection | null>(null);
  const [animating, setAnimating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!isActive) setShowPicker(false);
  }, [isActive]);

  // Load all entries for calendar display
  useEffect(() => {
    if (!user) return;
    fetchEntries(user.id).then(setEntries);
  }, [user]);

  // When selected date changes, populate form with existing entry
  useEffect(() => {
    const entry = entries[selectedDate];
    setNotes(entry?.notes ?? '');
    setSong(null); // song state can't be restored from DB easily, reset it
  }, [selectedDate, entries]);

  const existingEntry = entries[selectedDate];
  const submitted = existingEntry ? (existingEntry.clean ? 'clean' : 'red') : null;
  const isToday = selectedDate === todayKey;

  const handleLog = async (clean: boolean) => {
    if (!user || animating) return;
    setAnimating(true);
    await upsertEntry(user.id, selectedDate, clean, notes.trim(), null, song);
    const updated = await fetchEntries(user.id);
    setEntries(updated);
    if (!clean) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:-200px;left:-200px;right:-200px;bottom:-200px;background:rgb(210,0,0);z-index:999999;pointer-events:none;opacity:0;transition:opacity 0.2s ease-in;';
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
        setTimeout(() => {
          el.style.transition = 'opacity 1s ease-out';
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 1100);
        }, 1800);
      }));
    }
    if (clean) {
      triggerCleanConfetti();
      // Fire streak milestone notifications to followers
      const { streak } = computeStats(updated);
      if (STREAK_MILESTONES.has(streak)) {
        getFollowerIds(user.id).then(ids => {
          createNotificationsForMany(ids, 'streak_milestone', user.id, { streak_count: streak });
        });
      }
    }
    setTimeout(() => setAnimating(false), 1200);
  };

  const [y, m, d] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
    <div className="flex flex-col h-full tab-bar-padding">
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">

        <div className="mb-8">
          <h1 className="font-wordmark text-5xl text-foreground mb-3">The Gacker</h1>

          {/* Tappable date selector */}
          <button
            onPointerDown={e => { e.preventDefault(); setShowPicker(true); }}
            className="flex items-center gap-1.5 active:opacity-60 transition-opacity"
          >
            <span className="text-muted-foreground text-sm font-medium">{dateLabel}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {!isToday && (
            <button
              onPointerDown={e => { e.preventDefault(); setSelectedDate(todayKey); }}
              className="mt-1.5 text-xs text-clean font-medium active:opacity-60"
            >
              Back to today
            </button>
          )}
        </div>

        {submitted && (
          <div className={`rounded-2xl p-4 mb-6 border animate-fade-in ${
            submitted === 'clean'
              ? 'bg-clean/10 border-clean/30 text-clean'
              : 'bg-red/10 border-red/30 text-red'
          }`}>
            <p className="font-semibold text-sm">
              {submitted === 'clean' ? 'Clean day logged.' : 'Red day logged.'}
            </p>
            <p className="text-xs opacity-70 mt-0.5">
              {submitted === 'clean' ? 'Nothing to see here.' : "That's a mark — keep it moving."}
            </p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Song <span className="font-normal normal-case">(optional)</span>
            </label>
            <SongPicker value={song} onChange={setSong} />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Notes <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything to note about today…"
              rows={4}
              maxLength={2000}
              className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleLog(true)}
            disabled={animating}
            className="w-full h-16 rounded-2xl bg-clean text-clean-foreground font-semibold text-lg tracking-wide transition-all active:scale-95 disabled:opacity-60 shadow-[0_0_24px_hsl(142_71%_45%/0.25)]"
          >
            Clean Day
          </button>
          <button
            onClick={() => handleLog(false)}
            disabled={animating}
            className="w-full h-16 rounded-2xl bg-red text-red-foreground font-semibold text-lg tracking-wide transition-all active:scale-95 disabled:opacity-60 shadow-[0_0_24px_hsl(0_84%_60%/0.2)]"
          >
            Red Day
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {isToday ? 'Tap again to update today\'s entry.' : 'Logging for a past date.'}
        </p>
      </div>

      {showPicker && (
        <DatePickerSheet
          selected={selectedDate}
          entries={entries}
          onSelect={date => setSelectedDate(date)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
    </>
  );
};

export default LogTab;
