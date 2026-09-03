import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';

interface Props<T extends string> {
  tabs: readonly T[];
  current: T;
  onChange: (next: T) => void;
  enabled?: boolean;
  renderPanel: (tab: T) => React.ReactNode;
}

const SETTLE_MS = 300;
// Past this fraction of the width the swipe commits; below it, it springs back.
const COMMIT_RATIO = 0.25;
// A fast flick commits regardless of distance, in px/ms.
const FLICK_VELOCITY = 0.45;
const AXIS_THRESHOLD = 6;
// Iterating toward rest, no overshoot — the standard iOS deceleration feel.
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/**
 * Horizontally swipeable panel deck.
 *
 * Every frame of the drag is written straight to the DOM through refs. Driving
 * it from React state re-rendered the whole panel tree — a calendar, an image
 * grid or a track list — on every touchmove, which is what made it stutter.
 * React is only involved at the two ends of a gesture.
 *
 * Touch listeners are attached natively so touchmove can be non-passive:
 * React's synthetic ones are passive, so preventDefault is a no-op there and
 * the page kept scrolling vertically underneath a horizontal drag.
 */
function SwipeDeck<T extends string>({ tabs, current, onChange, enabled = true, renderPanel }: Props<T>) {
  const index = tabs.indexOf(current);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);

  // Both neighbours mount for the duration of a gesture, so nothing has to be
  // mounted mid-drag — a panel appearing on the first move was its own stutter.
  const [dragging, setDragging] = useState(false);

  const g = useRef({
    x: 0, y: 0, dx: 0,
    axis: 'undecided' as 'undecided' | 'h' | 'v',
    live: false, lastX: 0, lastT: 0, vx: 0,
  });

  const width = () => containerRef.current?.offsetWidth ?? window.innerWidth;

  const paint = (dx: number, animate: boolean) => {
    const W = width();
    const transition = animate ? `transform ${SETTLE_MS}ms ${EASE}` : 'none';
    const set = (el: HTMLDivElement | null, base: number) => {
      if (!el) return;
      el.style.transition = transition;
      el.style.transform = `translate3d(${base + dx}px,0,0)`;
    };
    set(activeRef.current, 0);
    set(prevRef.current, -W);
    set(nextRef.current, W);
  };

  // Position the neighbours the instant they mount, before the first move, so
  // they never flash in at the wrong offset.
  useLayoutEffect(() => {
    if (dragging) paint(g.current.dx, false);
  }, [dragging]);

  // After a commit the active panel is the new tab; snap everything to rest
  // without animating back through the old position.
  useLayoutEffect(() => {
    g.current.dx = 0;
    paint(0, false);
  }, [current]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest?.('[data-swipe-owner]')) return;
      const t = e.touches[0];
      g.current = {
        x: t.clientX, y: t.clientY, dx: 0, axis: 'undecided',
        live: true, lastX: t.clientX, lastT: performance.now(), vx: 0,
      };
      setDragging(true);
    };

    const onMove = (e: TouchEvent) => {
      const s = g.current;
      if (!s.live) return;
      const t = e.touches[0];
      const moveX = t.clientX - s.x;
      const moveY = t.clientY - s.y;

      if (s.axis === 'undecided') {
        if (Math.abs(moveX) > AXIS_THRESHOLD || Math.abs(moveY) > AXIS_THRESHOLD) {
          s.axis = Math.abs(moveX) > Math.abs(moveY) ? 'h' : 'v';
          if (s.axis === 'v') setDragging(false);
        }
        return;
      }
      if (s.axis !== 'h') return;

      // Axis lock: once this is a horizontal drag the page must not also
      // scroll. Only possible because the listener is non-passive.
      e.preventDefault();

      const now = performance.now();
      const dt = now - s.lastT;
      if (dt > 0) s.vx = (t.clientX - s.lastX) / dt;
      s.lastX = t.clientX;
      s.lastT = now;

      const target = moveX < 0 ? index + 1 : index - 1;
      const atEdge = target < 0 || target >= tabs.length;
      const W = width();
      // Rubber band at the ends, matching the calendar's boundary resistance.
      s.dx = atEdge
        ? Math.sign(moveX) * W * 0.3 * Math.log1p(Math.abs(moveX) / (W * 0.3))
        : moveX;
      paint(s.dx, false);
    };

    const onEnd = () => {
      const s = g.current;
      if (!s.live) return;
      s.live = false;
      if (s.axis !== 'h') { setDragging(false); return; }

      const W = width();
      const dir = s.dx < 0 ? 1 : -1;
      const target = index + dir;
      const far = Math.abs(s.dx) > W * COMMIT_RATIO;
      // A quick flick counts even if it did not travel far.
      const flicked = Math.abs(s.vx) > FLICK_VELOCITY && Math.sign(s.vx) === -dir;
      const commit = (far || flicked) && target >= 0 && target < tabs.length;

      if (commit) {
        haptic.light();
        paint(dir > 0 ? -W : W, true);
        window.setTimeout(() => {
          onChange(tabs[target]);
          setDragging(false);
        }, SETTLE_MS);
      } else {
        paint(0, true);
        window.setTimeout(() => {
          g.current.dx = 0;
          setDragging(false);
        }, SETTLE_MS);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, index, tabs, onChange]);

  const layer = 'absolute inset-0';
  const gpu: React.CSSProperties = { willChange: 'transform', backfaceVisibility: 'hidden' };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        // pan-y hands vertical scrolling to the system and horizontal to us, so
        // iOS never commits to a scroll before the axis is decided.
        touchAction: enabled ? 'pan-y' : undefined,
        overscrollBehaviorX: 'contain',
      }}
    >
      <div ref={activeRef} style={gpu}>
        {renderPanel(current)}
      </div>

      {dragging && index > 0 && (
        <div ref={prevRef} className={layer} aria-hidden style={gpu}>
          {renderPanel(tabs[index - 1])}
        </div>
      )}
      {dragging && index < tabs.length - 1 && (
        <div ref={nextRef} className={layer} aria-hidden style={gpu}>
          {renderPanel(tabs[index + 1])}
        </div>
      )}
    </div>
  );
}

export default SwipeDeck;
