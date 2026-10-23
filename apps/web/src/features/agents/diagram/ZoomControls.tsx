import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { IconButton } from '../../../components/ui';
import { zoomPercent } from './diagramZoom';
import type { DiagramZoom } from './useDiagramZoom';

/** `+`/`=` zoom in, `-` zooms out and `0` fits, while the focus is inside the diagram. */
export function handleZoomKeys(zoom: DiagramZoom, event: KeyboardEvent) {
  const actions: Record<string, () => void> = {
    '+': zoom.zoomIn,
    '=': zoom.zoomIn,
    '-': zoom.zoomOut,
    '0': zoom.fit,
  };
  const action = actions[event.key];
  if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  action();
}

export function ZoomControls({ zoom }: { zoom: DiagramZoom }) {
  return (
    <div
      role="group"
      aria-label="Zoom del diagrama"
      className="inline-flex shrink-0 items-center gap-1 border border-line bg-surface p-1"
    >
      <IconButton label="Acercar" onClick={zoom.zoomIn} disabled={!zoom.canZoomIn}>
        <ZoomIn aria-hidden className="size-4" />
      </IconButton>
      <IconButton label="Alejar" onClick={zoom.zoomOut} disabled={!zoom.canZoomOut}>
        <ZoomOut aria-hidden className="size-4" />
      </IconButton>
      <IconButton label="Encajar al ancho" onClick={zoom.fit} aria-pressed={zoom.isFit}>
        <Maximize aria-hidden className="size-4" />
      </IconButton>
      <output
        aria-live="polite"
        aria-label="Zoom actual"
        className="w-11 text-right font-mono text-xs text-fg-subtle"
      >
        {zoomPercent(zoom.scale)}
      </output>
    </div>
  );
}
