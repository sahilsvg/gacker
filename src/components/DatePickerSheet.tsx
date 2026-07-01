import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDateKey, Entry } from '@/lib/entries';

interface Props {
  selected: string; // YYYY-MM-DD
  entries: Record<string, Entry>;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LAUNCH = new Date(2026, 5, 27); // June 27 2026
LAUNCH.setHours(0, 0, 0, 0);

const DatePickerSheet = ({ selected, entries, onSelect, onClose }: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(selected + 'T00:00:00');
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selected + 'T00:00:00');
    return d.getMonth();
  });

  const canGoPrev = viewYear > 2026 || (viewYear === 2026 && viewMonth > 5);
  const canGoNext = viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[250] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onPointerDown={onClose} />
      <div className="relative bg-card rounded-t-3xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Select a date</h3>
          <button onPointerDown={e => { e.preventDefault(); onClose(); }} className="text-muted-foreground active:opacity-60">
            <X size={18} />
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button
            onPointerDown={e => { e.preventDefault(); prevMonth(); }}
            disabled={!canGoPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted transition-colors disabled:opacity-20"
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
          <button
            onPointerDown={e => { e.preventDefault(); nextMonth(); }}
            disabled={!canGoNext}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted transition-colors disabled:opacity-20"
          >
            <ChevronRight size={18} className="text-foreground" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 px-4 mb-1">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 px-4 pb-5">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(viewYear, viewMonth, i + 1);
            d.setHours(0, 0, 0, 0);
            const key = formatDateKey(d);
            const isSelected = key === selected;
            const isToday = key === formatDateKey(today);
            const isPreLaunch = d < LAUNCH;
            const isFuture = d > today;
            const entry = entries[key];
            const tappable = !isPreLaunch && !isFuture;

            let circleClass = '';
            let symbol = '';

            if (isSelected) {
              circleClass = 'bg-foreground text-background';
              symbol = entry?.clean ? '✓' : entry ? '✗' : String(i + 1);
            } else if (isPreLaunch) {
              circleClass = 'text-muted-foreground/20';
              symbol = '✗';
            } else if (isFuture) {
              circleClass = 'text-muted-foreground/25';
              symbol = String(i + 1);
            } else if (entry?.clean) {
              circleClass = 'bg-clean/20 text-clean border border-clean/40';
              symbol = '✓';
            } else if (entry && !entry.clean) {
              circleClass = 'bg-red/20 text-red border border-red/40';
              symbol = '✗';
            } else {
              circleClass = isToday ? 'border border-foreground/40 text-foreground' : 'text-muted-foreground';
              symbol = String(i + 1);
            }

            return (
              <div key={key} className="flex items-center justify-center py-1">
                <button
                  disabled={!tappable}
                  onPointerDown={e => {
                    e.preventDefault();
                    if (!tappable) return;
                    onSelect(key);
                    onClose();
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all active:scale-90 disabled:pointer-events-none ${circleClass}`}
                >
                  {symbol}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DatePickerSheet;
