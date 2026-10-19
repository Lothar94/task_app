import { ChevronsDownUp, ChevronsUpDown, Maximize2, Minimize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../../components/ui';

const TEXT_BUTTON =
  'inline-flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-xs text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

/** Title bar of the conversation block: tool-call controls, expand toggle and room for panel toggles. */
export function ConversationHeader({
  isExpanded,
  onToggleExpanded,
  canToggleTools,
  onExpandTools,
  onCollapseTools,
  leading,
  trailing,
}: {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  canToggleTools: boolean;
  onExpandTools: () => void;
  onCollapseTools: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-line bg-canvas px-3 py-1.5">
      {leading}
      <h2 className="label-mono-md mr-auto pl-1 text-fg-muted">Conversación</h2>
      <button type="button" disabled={!canToggleTools} onClick={onExpandTools} className={TEXT_BUTTON}>
        <ChevronsUpDown aria-hidden className="size-3.5" />
        <span className="sr-only md:not-sr-only">Desplegar todo</span>
      </button>
      <button type="button" disabled={!canToggleTools} onClick={onCollapseTools} className={TEXT_BUTTON}>
        <ChevronsDownUp aria-hidden className="size-3.5" />
        <span className="sr-only md:not-sr-only">Plegar todo</span>
      </button>
      <IconButton
        label={isExpanded ? 'Contraer conversación' : 'Expandir conversación'}
        aria-pressed={isExpanded}
        onClick={onToggleExpanded}
      >
        {isExpanded ? (
          <Minimize2 aria-hidden className="size-4" />
        ) : (
          <Maximize2 aria-hidden className="size-4" />
        )}
      </IconButton>
      {trailing}
    </div>
  );
}
