import { useRef, useCallback, RefObject } from 'react';

/**
 * Detects a downward swipe gesture and calls onDismiss when the threshold is crossed.
 * Pass scrollRef to only allow dismissal when the scrollable content is at the top.
 */
export function useSwipeToDismiss(
  onDismiss: () => void,
  scrollRef?: RefObject<HTMLElement>,
  threshold = 80,
) {
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.changedTouches[0].clientY - startY.current;
    const atTop = !scrollRef?.current || scrollRef.current.scrollTop <= 4;
    if (delta >= threshold && atTop) onDismiss();
    startY.current = null;
  }, [onDismiss, scrollRef, threshold]);

  return { onTouchStart, onTouchEnd };
}
