import { useRef } from 'react';
import { haptic } from '@/lib/haptics';

/**
 * Horizontal swipe to move between a set of tabs.
 *
 * Uses the same 6px axis threshold as the calendar's month swipe so both
 * settle on the same axis and neither steals a vertical scroll. Any element
 * marked `data-swipe-owner` keeps its own horizontal gesture — the calendar
 * swipes between months, so swipes landing on it never change tab.
 */
export function useSubTabSwipe<T extends string>(
  tabs: readonly T[],
  current: T,
  onChange: (next: T) => void,
) {
  const st = useRef({ x: 0, y: 0, axis: 'undecided' as 'undecided' | 'h' | 'v', live: false });

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest?.('[data-swipe-owner]')) {
      st.current.live = false;
      return;
    }
    st.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: 'undecided', live: true };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = st.current;
    if (!s.live || s.axis !== 'undecided') return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = st.current;
    s.live = false;
    if (s.axis !== 'h') return;
    const dx = e.changedTouches[0].clientX - s.x;
    // A quarter of the screen, matching the calendar's commit distance.
    if (Math.abs(dx) < window.innerWidth / 4) return;

    const i = tabs.indexOf(current);
    const next = dx < 0 ? i + 1 : i - 1;
    if (next < 0 || next >= tabs.length) return;
    haptic.light();
    onChange(tabs[next]);
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}
