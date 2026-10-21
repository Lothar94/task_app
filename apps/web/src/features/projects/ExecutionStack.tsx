import type { AgentDto, TaskNodeDto } from '@fleet/shared';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, FOCUS_RING } from '../../components/ui';
import { formatDuration, formatTokens } from '../../lib/format';
import { TaskStatusBadge, isTaskActive } from '../tasks/TaskStatusBadge';
import { taskLabel } from '../tasks/taskLabel';
import { countDescendants, subtreeMetrics } from '../tasks/taskTreeModel';
import { flattenDescendants, taskElapsedMs } from './inspectionModel';

const INDENT_REM = 1.25;

function Duration({ task, now }: { task: TaskNodeDto; now: number }) {
  const elapsed = taskElapsedMs(task, now);
  if (elapsed === null) return null;
  return (
    <span className="font-mono text-xs text-fg-muted">
      {formatDuration(elapsed)}
      {isTaskActive(task.status) && ' en curso'}
    </span>
  );
}

function TaskLink({ projectId, task }: { projectId: string; task: TaskNodeDto }) {
  return (
    <Link
      to={`/projects/${projectId}/tasks/${task.id}`}
      className={`font-mono text-xs whitespace-nowrap text-accent hover:underline ${FOCUS_RING}`}
    >
      {taskLabel(task.number)}
    </Link>
  );
}

function SubtaskItem({
  projectId,
  task,
  depth,
  now,
}: {
  projectId: string;
  task: TaskNodeDto;
  depth: number;
  now: number;
}) {
  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2 pr-4"
      style={{ paddingLeft: `${depth * INDENT_REM + 1}rem` }}
      data-depth={depth}
    >
      <TaskLink projectId={projectId} task={task} />
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{task.title}</span>
      <TaskStatusBadge status={task.status} />
      <Duration task={task} now={now} />
    </li>
  );
}

function RootItem({
  projectId,
  root,
  agentName,
  now,
}: {
  projectId: string;
  root: TaskNodeDto;
  agentName: string;
  now: number;
}) {
  const [expanded, setExpanded] = useState(isTaskActive(root.status));
  const subtasks = flattenDescendants(root);
  const listId = `stack-subtasks-${root.id}`;
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        {subtasks.length > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={`${expanded ? 'Contraer' : 'Expandir'} subtareas de ${taskLabel(root.number)}`}
            onClick={() => setExpanded((value) => !value)}
            className={`rounded-sm p-0.5 text-fg-muted hover:text-fg ${FOCUS_RING}`}
          >
            <ChevronRight
              aria-hidden
              className={`size-4 motion-safe:transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span aria-hidden className="size-5" />
        )}
        <TaskLink projectId={projectId} task={root} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{root.title}</span>
        <TaskStatusBadge status={root.status} />
        <span className="font-mono text-xs text-fg-muted">
          {agentName} · {countDescendants(root)} subtareas
        </span>
        <Duration task={root} now={now} />
        <span className="font-mono text-xs text-fg-muted">
          {formatTokens(subtreeMetrics(root).totalTokens)} tokens
        </span>
      </div>
      {subtasks.length > 0 && (
        <ul id={listId} hidden={!expanded} aria-label={`Subtareas de ${taskLabel(root.number)}`}>
          {subtasks.map(({ task, depth }) => (
            <SubtaskItem key={task.id} projectId={projectId} task={task} depth={depth} now={now} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ExecutionStack({
  projectId,
  roots,
  agents,
  now,
}: {
  projectId: string;
  roots: TaskNodeDto[];
  agents: AgentDto[];
  now: number;
}) {
  if (roots.length === 0) return <EmptyState>Este proyecto aún no tiene tareas.</EmptyState>;
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  return (
    <ul className="rounded-lg border border-line bg-surface" aria-label="Pila de ejecución reciente">
      {roots.map((root) => (
        <RootItem
          key={root.id}
          projectId={projectId}
          root={root}
          agentName={agentNames.get(root.agentId) ?? 'Agente desconocido'}
          now={now}
        />
      ))}
    </ul>
  );
}
