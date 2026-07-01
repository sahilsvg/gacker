import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDateKey, Entry } from '@/lib/entries';

interface Props {
  entries: Record<string, Entry>;
  onDayTap?: (dateKey: string, entry: Entry) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const buildMonth = (year: number, month: number): Date[] => {
  const days: Date[] = [];
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(new Date(year, month, d));
  return days;
};

const LAUNCH_DATE = new Date(2026, 5, 27);
LAUNCH_DATE.setHours(0, 0, 0, 0);

const MonthGrid = ({
  year, month, entries, onDayTap,
}: {
  year: number;
  month: number;
  entries: Record<string, Entry>;
  onDayTap?: (dateKey: string, entry: Entry) => void;
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = buildMonth(year, month);
  const firstDow = dates[0].getDay();
  const label = dates[0].toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-foreground mb-3">{label}</p>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`blank-${i}`} />)}
        {dates.map(d => {
          const key = formatDateKey(d);
          const isFuture = d > today;
          const isPreLaunch = d < LAUNCH_DATE;
          const entry = entries[key];
          const tappable = !!entry && !!onDayTap;

          let cellClass = '';
          let symbol = '';

          if (isPreLaunch) {
            cellClass = 'bg-muted/15 border border-border/20 text-muted-foreground/25';
            symbol = '✗';
          } else if (isFuture) {
            cellClass = 'bg-muted/30 border border-border/30 text-muted-foreground/40';
            symbol = '?';
          } else if (entry?.clean) {
            cellClass = 'bg-clean text-clean-foreground shadow-[0_0_8px_hsl(142_71%_45%/0.35)]';
            symbol = '✓';
          } else if (entry && !entry.clean) {
            cellClass = 'bg-red text-red-foreground shadow-[0_0_8px_hsl(0_84%_60%/0.3)]';
            symbol = '✗';
          } else {
            cellClass = 'bg-muted/30 border border-border/30';
          }

          return (
            <div key={key} className="flex flex-col items-center py-0.5">
              <span className="text-[9px] text-muted-foreground mb-0.5">{d.getDate()}</span>
              <button
                disabled={!tappable}
                onPointerDown={e => {
                  if (!tappable || !entry) return;
                  e.preventDefault();
                  onDayTap(key, entry);
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${cellClass} ${tappable ? 'active:scale-90' : ''}`}
              >
                {symbol}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CalendarView = ({ entries, onDayTap }: Props) => {
  const [historyOpen, setHistoryOpen] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const pastMonths: { year: number; month: number }[] = [];
  let y = currentYear;
  let m = currentMonth - 1;
  const limit = currentYear - 5;
  while (y > limit) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const hasEntry = Array.from({ length: daysInMonth }, (_, i) =>
      formatDateKey(new Date(y, m, i + 1))
    ).some(key => key in entries);
    if (hasEntry) pastMonths.push({ year: y, month: m });
    m--;
    if (m < 0) { m = 11; y--; }
  }

  return (
    <div>
      <MonthGrid year={currentYear} month={currentMonth} entries={entries} onDayTap={onDayTap} />

      <button
        onPointerDown={e => { e.preventDefault(); setHistoryOpen(v => !v); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-6 transition-opacity active:opacity-60"
      >
        <ChevronDown size={14} className={`transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
        {historyOpen ? 'Hide history' : 'History'}
      </button>

      {historyOpen && (
        pastMonths.length > 0
          ? pastMonths.map(({ year, month }) => (
              <MonthGrid key={`${year}-${month}`} year={year} month={month} entries={entries} onDayTap={onDayTap} />
            ))
          : <p className="text-sm text-muted-foreground mb-6">No history...for now.</p>
      )}
    </div>
  );
};

export default CalendarView;
