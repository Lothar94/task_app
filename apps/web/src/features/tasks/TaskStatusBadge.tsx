import type { TaskStatus } from '@fleet/shared';
import { StatusChip, type ChipTone } from '../../components/ui';
import { STATUS_LABELS } from './taskListModel';

interface StatusPresentation {
  tone: ChipTone;
  pulse?: boolean;
  dashed?: boolean;
}

export const STATUS_PRESENTATION: Record<TaskStatus, StatusPresentation> = {
  draft: { tone: 'neutral', dashed: true },
  queued: { tone: 'warning' },
  pending: { tone: 'neutral' },
  running: { tone: 'info', pulse: true },
  waiting_subtasks: { tone: 'warning' },
  completed: { tone: 'success' },
  failed: { tone: 'danger' },
  cancelled: { tone: 'neutral' },
};

export const isTaskActive = (status: TaskStatus) =>
  status === 'pending' || status === 'running' || status === 'waiting_subtasks';

/** Defined but not started yet: still editable and cancellable. */
export const isTaskPlanned = (status: TaskStatus) => status === 'draft' || status === 'queued';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusChip {...STATUS_PRESENTATION[status]}>{STATUS_LABELS[status]}</StatusChip>;
}
