import type { TaskStatus } from '@fleet/shared';
import { STATUS_LABELS } from './taskListModel';

const STATUS_CLASSES: Record<TaskStatus, string> = {
  draft: 'border border-dashed border-zinc-500 text-zinc-300',
  queued: 'bg-violet-500/20 text-violet-300',
  pending: 'bg-zinc-700 text-zinc-200',
  running: 'bg-sky-500/20 text-sky-300 animate-pulse',
  waiting_subtasks: 'bg-amber-500/20 text-amber-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-zinc-600/40 text-zinc-400',
};

export const isTaskActive = (status: TaskStatus) =>
  status === 'pending' || status === 'running' || status === 'waiting_subtasks';

/** Defined but not started yet: still editable and cancellable. */
export const isTaskPlanned = (status: TaskStatus) => status === 'draft' || status === 'queued';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
