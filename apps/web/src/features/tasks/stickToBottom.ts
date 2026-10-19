import { useCallback, useLayoutEffect, useRef } from 'react';

const NEAR_BOTTOM_PX = 48;

interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** True while the viewport is at (or within a few pixels of) the end of the content. */
export const isNearBottom = (
  { scrollHeight, scrollTop, clientHeight }: ScrollMetrics,
  threshold = NEAR_BOTTOM_PX,
) => scrollHeight - scrollTop - clientHeight <= threshold;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * "Stick to bottom" for a scroll container: jumps to the end on mount and whenever `trigger`
 * changes, unless the user has scrolled up. Attach `ref` and `onScroll` to the container.
 */
export function useStickToBottom<T extends HTMLElement>(trigger: unknown) {
  const ref = useRef<T>(null);
  const isStuck = useRef(true);
  const isFirstRun = useRef(true);

  const onScroll = useCallback(() => {
    if (ref.current) isStuck.current = isNearBottom(ref.current);
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !isStuck.current) return;
    const animate = !isFirstRun.current && !prefersReducedMotion();
    isFirstRun.current = false;
    element.scrollTo({ top: element.scrollHeight, behavior: animate ? 'smooth' : 'auto' });
  }, [trigger]);

  return { ref, onScroll };
}
