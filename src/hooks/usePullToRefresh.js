import { useEffect, useRef, useState } from 'react';

// Native-feeling pull-to-refresh for scrollable containers in WebView.
// Attach the returned scrollRef to a scrollable element (overflow-y-auto + fixed height).
export function usePullToRefresh(onRefresh, { threshold = 70, maxPull = 120 } = {}) {
  const scrollRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      if (el.scrollTop <= 0 && !refreshing) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      } else {
        pulling.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!pulling.current || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && el.scrollTop <= 0) {
        e.preventDefault();
        setPullDistance(Math.min(delta * 0.5, maxPull));
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= threshold) {
        setRefreshing(true);
        setPullDistance(threshold);
        try {
          await cbRef.current?.();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, refreshing, threshold, maxPull]);

  return { scrollRef, pullDistance, refreshing };
}