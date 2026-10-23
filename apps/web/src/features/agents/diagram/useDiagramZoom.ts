import { useEffect, useRef, useState } from 'react';
import { fitScale, MAX_ZOOM, MIN_ZOOM, zoomInFrom, zoomOutFrom } from './diagramZoom';

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Zoom of a diagram `contentWidth` wide: fitted to its container until the user zooms in or out. */
export function useDiagramZoom(contentWidth: number) {
  const [containerRef, containerWidth] = useElementWidth();
  const [manualScale, setManualScale] = useState<number | null>(null);
  const scale = manualScale ?? fitScale(containerWidth, contentWidth);
  return {
    containerRef,
    scale,
    isFit: manualScale === null,
    canZoomIn: scale < MAX_ZOOM,
    canZoomOut: scale > MIN_ZOOM,
    zoomIn: () => setManualScale(zoomInFrom(scale)),
    zoomOut: () => setManualScale(zoomOutFrom(scale)),
    fit: () => setManualScale(null),
  };
}

export type DiagramZoom = ReturnType<typeof useDiagramZoom>;
