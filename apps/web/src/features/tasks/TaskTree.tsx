import type { TaskNodeDto } from '@fleet/shared';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState, FOCUS_RING } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { formatCost, formatDuration, formatInteger, formatTokens } from '../../lib/format';
import { TaskLabels } from './TaskLabels';
import { ProposalNote } from './ProposalNote';
import { TaskNumber } from './taskLabel';
import { isTaskActive, TaskStatusBadge } from './TaskStatusBadge';
import { countDescendants, subtreeMetrics } from './taskTreeModel';

interface TaskTreeProps {
  projectId: string;
  nodes: TaskNodeDto[];
  agentNames: Map<string, string>;
  /** Narrow layout without the metric columns (sidebars). */
  compact?: boolean;
  /** Render the nodes in the given order instead of newest first. */
  keepOrder?: boolean;
  hideHeader?: boolean;
}

type RowProps = Omit<TaskTreeProps, 'nodes'> & { node: TaskNodeDto; depth: number };

const COLUMNS =
  'grid-cols-[1.75rem_minmax(0,1fr)_auto] md:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_6.5rem_10rem]';

const hasActiveWork = (node: TaskNodeDto): boolean =>
  isTaskActive(node.status) || node.children.some(hasActiveWork);

function wallClockMs(node: TaskNodeDto, now: number): number | null {
  if (!node.startedAt) return null;
  const end = node.finishedAt ? Date.parse(node.finishedAt) : now;
  return Math.max(0, end - Date.parse(node.startedAt));
}

function DurationCell({ node }: { node: TaskNodeDto }) {
  const isActive = isTaskActive(node.status);
  const now = useNow(isActive);
  const elapsed = wallClockMs(node, now);
  const working =
    node.metrics.runs > 0 ? `Tiempo trabajando: ${formatDuration(node.metrics.durationMs)}` : '';
  return (
    <span title={working} className="text-right font-mono text-xs text-fg-muted tabular-nums">
      {elapsed === null ? '—' : formatDuration(elapsed)}
      {isActive && elapsed !== null && <span className="label-mono block text-info">en curso</span>}
    </span>
  );
}

function TokensCell({ node }: { node: TaskNodeDto }) {
  const own = node.metrics;
  const total = subtreeMetrics(node);
  const tooltip = [
    `Total: ${formatInteger(total.totalTokens)} tokens (coste estimado ${formatCost(total.costUsd)})`,
    node.children.length > 0
      ? `Esta tarea: ${formatInteger(own.totalTokens)} · subtareas: ${formatInteger(total.totalTokens - own.totalTokens)}`
      : '',
    `Entrada ${formatInteger(total.inputTokens)} · salida ${formatInteger(total.outputTokens)} · caché ${formatInteger(total.cacheReadTokens + total.cacheCreationTokens)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <span title={tooltip} className="text-right font-mono text-xs text-fg-muted tabular-nums">
      {total.totalTokens === 0 ? '—' : formatTokens(total.totalTokens)}
      {node.children.length > 0 && total.totalTokens > 0 && (
        <span className="label-mono block text-fg-subtle">con subtareas</span>
      )}
    </span>
  );
}

function ToggleButton({ isOpen, onToggle, count }: { isOpen: boolean; onToggle: () => void; count: number }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? 'Ocultar' : 'Mostrar'} ${count} subtareas`}
      className={`flex size-6 items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg ${FOCUS_RING}`}
    >
      <ChevronRight
        aria-hidden
        className={`size-4 transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-90' : ''}`}
      />
    </button>
  );
}

function TaskRow({ node, depth, projectId, agentNames, compact }: RowProps) {
  const [isOpen, setIsOpen] = useState(() => hasActiveWork(node));
  const descendants = countDescendants(node);
  return (
    <li>
      <div
        className={`grid items-center gap-x-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-hover ${compact ? 'grid-cols-[1.75rem_minmax(0,1fr)_auto]' : COLUMNS}`}
      >
        <span>
          {node.children.length > 0 && (
            <ToggleButton isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} count={descendants} />
          )}
        </span>
        <Link
          to={`/projects/${projectId}/tasks/${node.id}`}
          className={`flex min-w-0 items-start gap-2 rounded ${FOCUS_RING}`}
        >
          <TaskNumber number={node.number} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg hover:text-accent">{node.title}</span>
            <span className="text-xs text-fg-subtle">
              {agentNames.get(node.agentId) ?? 'Agente eliminado'}
              {descendants > 0 && ` · ${descendants} subtarea${descendants === 1 ? '' : 's'}`}
            </span>
            <ProposalNote task={node} agentNames={agentNames} />
            {depth === 0 && <TaskLabels milestone={node.milestone} tags={node.tags} />}
          </span>
        </Link>
        {!compact && (
          <span className="hidden md:contents">
            <DurationCell node={node} />
            <TokensCell node={node} />
          </span>
        )}
        <span className="justify-self-end">
          <TaskStatusBadge status={node.status} />
        </span>
      </div>
      {isOpen && node.children.length > 0 && (
        <ul className="mb-1 ml-5 border-l border-line pl-2">
          {node.children.map((child) => (
            <TaskRow
              key={child.id}
              node={child}
              depth={depth + 1}
              projectId={projectId}
              agentNames={agentNames}
              compact={compact}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function HeaderRow() {
  return (
    <div
      className={`hidden gap-x-3 label-mono border-b border-line px-2 pb-2 text-fg-subtle md:grid ${COLUMNS}`}
    >
      <span />
      <span>Tarea</span>
      <span className="text-right">Duración</span>
      <span className="text-right">Tokens</span>
      <span className="text-right">Estado</span>
    </div>
  );
}

/** Tasks with their delegated subtasks nested and collapsible; active branches start expanded. */
export function TaskTree({
  projectId,
  nodes,
  agentNames,
  compact = false,
  keepOrder = false,
  hideHeader = false,
}: TaskTreeProps) {
  if (nodes.length === 0) return <EmptyState>Todavía no hay tareas.</EmptyState>;
  return (
    <div>
      {!compact && !hideHeader && <HeaderRow />}
      <ul className="divide-y divide-line">
        {(keepOrder ? nodes : [...nodes].reverse()).map((node) => (
          <TaskRow
            key={node.id}
            node={node}
            depth={0}
            projectId={projectId}
            agentNames={agentNames}
            compact={compact}
          />
        ))}
      </ul>
    </div>
  );
}
