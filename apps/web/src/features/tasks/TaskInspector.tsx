import type { TaskDto, TaskNodeDto } from '@fleet/shared';
import { CornerDownRight, PanelRight, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Accordion } from '../../components/Accordion';
import { IconButton } from '../../components/ui';
import { formatDuration, formatTokens } from '../../lib/format';
import { TaskStatusBadge } from './TaskStatusBadge';
import { taskLabel } from './taskLabel';
import { SCROLL_PANEL, anchorDomId } from './taskPanelStyles';
import { useTaskTree } from './taskQueries';
import { findNode } from './taskTreeModel';

function InspectorSection({
  title,
  meta,
  anchor,
  children,
}: {
  title: string;
  meta?: string;
  anchor?: string;
  children: ReactNode;
}) {
  return (
    <div id={anchor && anchorDomId(anchor)}>
      <Accordion
        defaultOpen
        header={<h3 className="label-mono text-fg-muted">{title}</h3>}
        trailing={meta && <span className="label-mono text-fg-subtle">{meta}</span>}
        bodyClassName="border-t border-line p-3"
      >
        {children}
      </Accordion>
    </div>
  );
}

function SubtaskCard({ node, agentNames }: { node: TaskNodeDto; agentNames: Map<string, string> }) {
  const hasRuns = node.metrics.runs > 0;
  return (
    <li>
      <Link
        to={`/projects/${node.projectId}/tasks/${node.id}`}
        className="block rounded-md border border-line bg-canvas p-3 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="label-mono text-fg-subtle">{taskLabel(node.number)}</span>
          <TaskStatusBadge status={node.status} />
        </span>
        <span className="mt-1 block text-sm font-semibold text-fg [overflow-wrap:anywhere]">
          {node.title}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 font-mono text-xs">
          <span className="text-accent">{agentNames.get(node.agentId) ?? '?'}</span>
          {hasRuns && (
            <span className="text-fg-subtle">
              {formatDuration(node.metrics.durationMs)} · {formatTokens(node.metrics.totalTokens)} tokens
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function HierarchyNode({
  node,
  agentNames,
  depth,
}: {
  node: TaskNodeDto;
  agentNames: Map<string, string>;
  depth: number;
}) {
  return (
    <li>
      <span
        className="flex items-center gap-1 font-mono text-xs text-fg"
        style={{ paddingLeft: `${depth}rem` }}
      >
        {depth > 0 && <CornerDownRight aria-hidden className="size-3 shrink-0 text-fg-subtle" />}
        {agentNames.get(node.agentId) ?? '?'}
      </span>
      {node.children.length > 0 && (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} agentNames={agentNames} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Right rail of the task page: delegated subtasks and the agent hierarchy, scrolling on their own. */
export function TaskInspector({
  task,
  agentNames,
  onClose,
}: {
  task: TaskDto;
  agentNames: Map<string, string>;
  /** Only set when the inspector is shown as a drawer. */
  onClose?: () => void;
}) {
  const tree = useTaskTree(task.projectId);
  const node = tree.data ? findNode(tree.data, task.id) : undefined;
  const subtasks = node?.children ?? [];
  const done = subtasks.filter((subtask) => subtask.status === 'completed').length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <PanelRight aria-hidden className="size-4 text-fg-muted" />
        <h2 className="label-mono-md mr-auto text-fg-muted">Inspector de tarea</h2>
        {onClose && (
          <IconButton label="Cerrar inspector" onClick={onClose}>
            <X aria-hidden className="size-4" />
          </IconButton>
        )}
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Contenido del inspector"
        className={`min-h-0 flex-1 space-y-3 p-4 ${SCROLL_PANEL}`}
      >
        <InspectorSection
          title="Subtareas delegadas"
          anchor="subtasks"
          meta={subtasks.length > 0 ? `${done}/${subtasks.length} listas` : undefined}
        >
          {subtasks.length === 0 ? (
            <p className="text-sm text-fg-subtle">Ninguna.</p>
          ) : (
            <ul className="space-y-2">
              {subtasks.map((subtask) => (
                <SubtaskCard key={subtask.id} node={subtask} agentNames={agentNames} />
              ))}
            </ul>
          )}
        </InspectorSection>
        {node && subtasks.length > 0 && (
          <InspectorSection title="Jerarquía">
            <ul>
              <HierarchyNode node={node} agentNames={agentNames} depth={0} />
            </ul>
          </InspectorSection>
        )}
      </div>
    </div>
  );
}
