import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { formatDateKey, saveEntry, getEntries } from '@/lib/storage';

const triggerCleanConfetti = () => {
  const colors = ['#22C55E', '#16a34a', '#86efac', '#ffffff'];
  const end = Date.now() + 1000;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, startVelocity: 50, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, startVelocity: 50, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const LogTab = () => {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const existing = getEntries()[todayKey];

  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [submitted, setSubmitted] = useState<'clean' | 'red' | null>(
    existing ? (existing.clean ? 'clean' : 'red') : null
  );
  const [animating, setAnimating] = useState(false);

  const handleLog = (clean: boolean) => {
    if (animating) return;
    setAnimating(true);
    saveEntry(todayKey, { clean, notes: notes.trim(), timestamp: Date.now() });
    setSubmitted(clean ? 'clean' : 'red');
    if (clean) triggerCleanConfetti();
    setTimeout(() => setAnimating(false), 1200);
  };

  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col h-full tab-bar-padding">
      <div className="flex-1 overflow-y-auto px-5 pt-16 pb-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-wordmark text-5xl text-foreground mb-1">The Gacker</h1>
          <p className="text-muted-foreground text-sm font-medium">{dateLabel}</p>
        </div>

        {/* Status banner if already logged */}
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

        {/* Notes */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Notes <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything to note about today…"
            rows={5}
            maxLength={2000}
            className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        {/* Log buttons */}
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
          Tap again to update today's entry.
        </p>
      </div>
    </div>
  );
};

export default LogTab;
