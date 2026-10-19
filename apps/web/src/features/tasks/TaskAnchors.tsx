import { FileCheck2, LayoutGrid, type LucideIcon, MessagesSquare, Network } from 'lucide-react';
import { FOCUS_RING } from '../../components/ui';

export type AnchorId = 'overview' | 'result' | 'conversation' | 'subtasks';

const ANCHORS: { id: AnchorId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Resumen', icon: LayoutGrid },
  { id: 'result', label: 'Resultado', icon: FileCheck2 },
  { id: 'conversation', label: 'Conversación', icon: MessagesSquare },
  { id: 'subtasks', label: 'Subtareas', icon: Network },
];

const VARIANT_STYLES = {
  rail: {
    list: 'space-y-0.5',
    item: 'flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left font-mono text-xs',
  },
  tabs: {
    list: 'flex gap-1 overflow-x-auto px-3',
    item: 'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 font-mono text-xs whitespace-nowrap',
  },
} as const;

/** In-page navigation to the blocks of the task: a vertical rail on wide screens, a tab row otherwise. */
export function TaskAnchors({
  variant,
  active,
  onSelect,
}: {
  variant: keyof typeof VARIANT_STYLES;
  active: AnchorId;
  onSelect: (id: AnchorId) => void;
}) {
  const styles = VARIANT_STYLES[variant];
  const activeStyle =
    variant === 'rail' ? 'border-accent bg-surface-hover text-accent' : 'border-accent text-accent';
  return (
    <nav aria-label="Secciones de la tarea">
      <ul className={styles.list}>
        {ANCHORS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={isActive ? 'location' : undefined}
                onClick={() => onSelect(id)}
                className={`${styles.item} transition-colors ${FOCUS_RING} focus-visible:-outline-offset-2 ${isActive ? activeStyle : 'border-transparent text-fg-subtle hover:bg-surface-hover hover:text-fg'}`}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
