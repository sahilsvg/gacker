import React, { useRef, useState, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

const THRESHOLD = 72;
const MAX_PULL = 100;

const PullToRefresh = ({ onRefresh, children, className = '' }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) return;
    // Resistance curve — gets harder to pull the further you go
    const pull = Math.min(delta * 0.45, MAX_PULL);
    setPullY(pull);
    if (pull >= THRESHOLD && !triggered) {
      setTriggered(true);
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } else if (pull < THRESHOLD && triggered) {
      setTriggered(false);
    }
  }, [refreshing, triggered]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(THRESHOLD * 0.65);
      await onRefresh();
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      setRefreshing(false);
    }

    setPullY(0);
    setTriggered(false);
  }, [pullY, onRefresh]);

  const spinnerOpacity = Math.min(pullY / THRESHOLD, 1);
  const spinnerScale = 0.5 + Math.min(pullY / THRESHOLD, 1) * 0.5;

  return (
    <div className={`relative flex flex-col h-full ${className}`}>
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{
          top: 52,
          opacity: spinnerOpacity,
          transform: `scale(${spinnerScale})`,
          transition: refreshing ? 'none' : 'opacity 0.1s, transform 0.1s',
        }}
      >
        <div className={`w-8 h-8 rounded-full border-2 border-clean/30 border-t-clean ${refreshing ? 'animate-spin' : ''}`} />
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          transform: `translateY(${pullY}px)`,
          transition: pullingRef.current ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
