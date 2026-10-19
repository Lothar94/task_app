import type { TaskDto } from '@fleet/shared';
import { useAgents } from '../agents/agentQueries';
import type { ChipTone } from '../../components/ui';
import { type AnchorId, TaskAnchors } from './TaskAnchors';
import { STATUS_LABELS } from './taskListModel';
import { taskLabel } from './taskLabel';
import { STATUS_PRESENTATION } from './TaskStatusBadge';

const DOT_STYLES: Record<ChipTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-fg-subtle',
};

/** Narrow left rail: identity card of the task and navigation between its blocks. */
export function TaskSidebar({
  task,
  agentName,
  active,
  onSelect,
}: {
  task: TaskDto;
  agentName: string;
  active: AnchorId;
  onSelect: (id: AnchorId) => void;
}) {
  const role = useAgents().data?.find((agent) => agent.id === task.agentId)?.role;
  const { tone } = STATUS_PRESENTATION[task.status];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-3">
      <div className="space-y-2 border border-line-strong bg-surface p-3">
        <p className="flex items-center gap-2">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT_STYLES[tone]}`} />
          <span className="min-w-0 truncate font-mono text-sm font-semibold text-fg">
            {taskLabel(task.number)} // {agentName.toUpperCase()}
          </span>
        </p>
        <p className="line-clamp-2 text-xs text-fg-muted [overflow-wrap:anywhere]">{task.title}</p>
        <dl className="space-y-1 border-t border-line pt-2 font-mono text-xs">
          {role && (
            <div className="flex justify-between gap-2">
              <dt className="text-fg-subtle">Rol</dt>
              <dd className="min-w-0 truncate text-fg-muted" title={role}>
                {role}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">Estado</dt>
            <dd className="text-fg-muted">{STATUS_LABELS[task.status]}</dd>
          </div>
        </dl>
      </div>
      <TaskAnchors variant="rail" active={active} onSelect={onSelect} />
    </div>
  );
}
