import React, { useEffect, useRef, useState } from 'react';
import { formatDateKey, Entry } from '@/lib/entries';

interface Props {
  entries: Record<string, Entry>;
  onDayTap?: (dateKey: string, entry: Entry) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// First day of the launch month — can't swipe before this
const LAUNCH_MONTH = new Date(2026, 5, 1);
LAUNCH_MONTH.setHours(0, 0, 0, 0);

const buildMonth = (year: number, month: number): Date[] => {
  const total = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => new Date(year, month, i + 1));
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
    <div>
      <p className="text-sm font-semibold text-foreground text-center mb-3">{label}</p>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
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
          } else if (entry) {
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
                  onDayTap!(key, entry);
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
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Boundary refs — updated every render, read by the single-mount gesture effect
  const canGoPrevRef = useRef(false);
  const canGoNextRef = useRef(false);

  const getDate = (off: number) => new Date(now.getFullYear(), now.getMonth() + off, 1);
  const prevDate = getDate(monthOffset - 1);
  const currDate = getDate(monthOffset);
  const nextDate = getDate(monthOffset + 1);

  canGoPrevRef.current = prevDate >= LAUNCH_MONTH;
  canGoNextRef.current =
    nextDate.getFullYear() < now.getFullYear() ||
    (nextDate.getFullYear() === now.getFullYear() && nextDate.getMonth() <= now.getMonth());

  // Set initial track position on mount
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = 'translateX(-33.333%)';
    }
  }, []);

  // Gesture handling — registers once, uses refs for live boundary values
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    let startX = 0, startY = 0;
    let determined = false, isHoriz = false;

    const setX = (xPx: number, animated: boolean) => {
      track.style.transition = animated
        ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        : 'none';
      track.style.transform = `translateX(calc(-33.333% + ${xPx}px))`;
    };

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      determined = false;
      isHoriz = false;
      track.style.transition = 'none';
    };

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!determined) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          isHoriz = Math.abs(dx) > Math.abs(dy);
          determined = true;
        }
        return;
      }
      if (!isHoriz) return;
      e.preventDefault();

      const W = wrapper.offsetWidth;
      const atBoundary =
        (dx > 0 && !canGoPrevRef.current) ||
        (dx < 0 && !canGoNextRef.current);

      // Rubber band resistance when at a boundary
      const effectiveDx = atBoundary
        ? Math.sign(dx) * W * 0.28 * Math.log1p(Math.abs(dx) / (W * 0.28))
        : dx;

      setX(effectiveDx, false);
    };

    const onEnd = (e: TouchEvent) => {
      if (!isHoriz) return;
      const dx = e.changedTouches[0].clientX - startX;
      const W = wrapper.offsetWidth;

      if (dx > W / 4 && canGoPrevRef.current) {
        setX(W, true);
        setTimeout(() => {
          setMonthOffset(o => o - 1);
          track.style.transition = 'none';
          track.style.transform = 'translateX(-33.333%)';
        }, 310);
      } else if (dx < -(W / 4) && canGoNextRef.current) {
        setX(-W, true);
        setTimeout(() => {
          setMonthOffset(o => o + 1);
          track.style.transition = 'none';
          track.style.transform = 'translateX(-33.333%)';
        }, 310);
      } else {
        // Bounce back
        setX(0, true);
      }
    };

    wrapper.addEventListener('touchstart', onStart, { passive: true });
    wrapper.addEventListener('touchmove', onMove, { passive: false });
    wrapper.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      wrapper.removeEventListener('touchstart', onStart);
      wrapper.removeEventListener('touchmove', onMove);
      wrapper.removeEventListener('touchend', onEnd);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="overflow-hidden">
      <div
        ref={trackRef}
        style={{ display: 'flex', width: '300%', willChange: 'transform' }}
      >
        {[prevDate, currDate, nextDate].map((d, i) => (
          <div key={i} style={{ width: '33.333%', flexShrink: 0, boxSizing: 'border-box', padding: '0 2px' }}>
            <MonthGrid
              year={d.getFullYear()}
              month={d.getMonth()}
              entries={entries}
              onDayTap={onDayTap}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarView;
