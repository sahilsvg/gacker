import React, { useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';

interface Props<T extends string> {
  tabs: readonly T[];
  current: T;
  onChange: (next: T) => void;
  enabled?: boolean;
  renderPanel: (tab: T) => React.ReactNode;
}

const SETTLE_MS = 260;
// Past this fraction of the width the swipe commits; below it, it springs back.
const COMMIT_RATIO = 0.28;

/**
 * Horizontally swipeable panel deck.
 *
 * The panel tracks the finger rather than switching on release, so the next
 * tab is already partly visible while dragging. Only the current panel and the
 * one being dragged toward are mounted — rendering all four would load every
 * image in the grid on open, and the neighbour is dropped again as soon as the
 * gesture settles.
 */
function SwipeDeck<T extends string>({ tabs, current, onChange, enabled = true, renderPanel }: Props<T>) {
  const index = tabs.indexOf(current);
  const containerRef = useRef<HTMLDivElement>(null);

  // dx drives the transform; neighbour is the index being dragged toward.
  const [dx, setDx] = useState(0);
  const [neighbour, setNeighbour] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);

  const gesture = useRef({ x: 0, y: 0, axis: 'undecided' as 'undecided' | 'h' | 'v', live: false });

  const width = () => containerRef.current?.offsetWidth ?? window.innerWidth;

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled || settling) return;
    // Defer to anything running its own horizontal gesture.
    if ((e.target as HTMLElement).closest?.('[data-swipe-owner]')) {
      gesture.current.live = false;
      return;
    }
    gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: 'undecided', live: true };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (!g.live) return;

    const moveX = e.touches[0].clientX - g.x;
    const moveY = e.touches[0].clientY - g.y;

    if (g.axis === 'undecided') {
      if (Math.abs(moveX) > 6 || Math.abs(moveY) > 6) {
        g.axis = Math.abs(moveX) > Math.abs(moveY) ? 'h' : 'v';
      }
      return;
    }
    if (g.axis !== 'h') return;

    const target = moveX < 0 ? index + 1 : index - 1;
    const atEdge = target < 0 || target >= tabs.length;
    // Rubber band at the ends, same feel as the calendar's boundary.
    const W = width();
    const eased = atEdge
      ? Math.sign(moveX) * W * 0.28 * Math.log1p(Math.abs(moveX) / (W * 0.28))
      : moveX;

    setNeighbour(atEdge ? null : target);
    setDx(eased);
  };

  const onTouchEnd = () => {
    const g = gesture.current;
    g.live = false;
    if (g.axis !== 'h') return;

    const W = width();
    const target = dx < 0 ? index + 1 : index - 1;
    const commit = Math.abs(dx) > W * COMMIT_RATIO && target >= 0 && target < tabs.length;

    setSettling(true);
    if (commit) {
      haptic.light();
      setDx(dx < 0 ? -W : W);
      // Swap after the slide finishes, then drop the offset in the same frame
      // so the new panel lands at rest without a visible jump back.
      window.setTimeout(() => {
        onChange(tabs[target]);
        setDx(0);
        setNeighbour(null);
        setSettling(false);
      }, SETTLE_MS);
    } else {
      setDx(0);
      window.setTimeout(() => {
        setNeighbour(null);
        setSettling(false);
      }, SETTLE_MS);
    }
  };

  const ease = settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)` : 'none';

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      // pan-y keeps vertical scrolling native while horizontal is ours, so iOS
      // does not commit to a scroll before the axis threshold is reached.
      style={{ touchAction: enabled ? 'pan-y' : undefined }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div style={{ transform: `translate3d(${dx}px,0,0)`, transition: ease, willChange: 'transform' }}>
        {renderPanel(current)}
      </div>

      {neighbour !== null && (
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            transform: `translate3d(calc(${dx}px + ${dx < 0 ? '100%' : '-100%'}),0,0)`,
            transition: ease,
            willChange: 'transform',
          }}
        >
          {renderPanel(tabs[neighbour])}
        </div>
      )}
    </div>
  );
}

export default SwipeDeck;
