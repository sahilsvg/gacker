import { useRef } from 'react';

/**
 * Returns pointer event props that distinguish a tap from a scroll/swipe.
 * The callback only fires on pointerUp if the finger moved less than
 * `threshold` pixels — matching the Instagram/Twitter "scroll wins" behaviour.
 *
 * Usage:
 *   const tap = useTap(() => doSomething());
 *   <div {...tap.props}>...</div>
 *
 * For double-tap detection pass a `lastTap` ref externally and handle it
 * inside the callback as normal — this hook just gates on swipe vs tap.
 */
export function useTap(
  callback: (e: React.PointerEvent) => void,
  threshold = 8,
) {
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (moved.current) return;
    const dx = Math.abs(e.clientX - startX.current);
    const dy = Math.abs(e.clientY - startY.current);
    if (dx > threshold || dy > threshold) moved.current = true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!moved.current) callback(e);
  };

  return {
    props: { onPointerDown, onPointerMove, onPointerUp } as React.HTMLAttributes<HTMLElement>,
  };
}

type TapHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
};

/**
 * Wraps tap handlers so a control nested inside a tappable row wins over the
 * row — e.g. an avatar that opens a profile inside a row that opens a post.
 */
export const stopParentTap = (h: TapHandlers): TapHandlers => ({
  onPointerDown: e => { e.stopPropagation(); h.onPointerDown(e); },
  onPointerMove: e => { e.stopPropagation(); h.onPointerMove(e); },
  onPointerUp: e => { e.stopPropagation(); h.onPointerUp(e); },
});

/**
 * Same as useTap but per-item — pass a key to track movement per element.
 * Returns a function that, given a key + callback, returns the three handlers.
 * Useful for lists where each row needs independent swipe tracking.
 */
export function useTapList(threshold = 8) {
  const startX = useRef<Record<string, number>>({});
  const startY = useRef<Record<string, number>>({});
  const moved = useRef<Record<string, boolean>>({});

  return (key: string, callback: (e: React.PointerEvent) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      startX.current[key] = e.clientX;
      startY.current[key] = e.clientY;
      moved.current[key] = false;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (moved.current[key]) return;
      const dx = Math.abs(e.clientX - (startX.current[key] ?? e.clientX));
      const dy = Math.abs(e.clientY - (startY.current[key] ?? e.clientY));
      if (dx > threshold || dy > threshold) moved.current[key] = true;
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!moved.current[key]) callback(e);
    },
  });
}
