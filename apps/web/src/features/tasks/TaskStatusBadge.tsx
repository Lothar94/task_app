import type { TaskStatus } from '@fleet/shared';

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-zinc-700 text-zinc-200' },
  running: { label: 'Trabajando', className: 'bg-sky-500/20 text-sky-300 animate-pulse' },
  waiting_subtasks: { label: 'Esperando subtareas', className: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Completada', className: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Fallida', className: 'bg-red-500/20 text-red-300' },
  cancelled: { label: 'Cancelada', className: 'bg-zinc-600/40 text-zinc-400' },
};

export const isTaskActive = (status: TaskStatus) =>
  status === 'pending' || status === 'running' || status === 'waiting_subtasks';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
