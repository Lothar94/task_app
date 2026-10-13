import type { TaskDto, TaskStatus } from '@fleet/shared';
import { useState } from 'react';
import { Markdown } from '../../components/Markdown';

const RESULT_STYLES: Partial<Record<TaskStatus, { label: string; className: string }>> = {
  completed: { label: 'Resultado', className: 'border-emerald-900 bg-emerald-950/20' },
  failed: { label: 'La tarea ha fallado', className: 'border-red-900 bg-red-950/30' },
  cancelled: { label: 'Tarea cancelada', className: 'border-zinc-700 bg-zinc-900/60' },
};
const IN_PROGRESS = { label: 'Resultado provisional', className: 'border-sky-900 bg-sky-950/20' };

/**
 * Full-width, collapsible summary of what the agent delivered. It is remounted whenever the
 * summary changes (see the key in TaskView), so a newly generated result always shows up expanded.
 */
export function ResultPanel({ task }: { task: TaskDto }) {
  const [isOpen, setIsOpen] = useState(true);
  const { label, className } = RESULT_STYLES[task.status] ?? IN_PROGRESS;

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className={`min-w-0 rounded-lg border ${className}`}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-3">
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <span className="text-xs text-zinc-500">{isOpen ? 'Ocultar' : 'Mostrar'}</span>
      </summary>
      <div className="border-t border-zinc-800/80 px-5 py-4">
        <Markdown className="prose-base">{task.resultSummary ?? ''}</Markdown>
      </div>
    </details>
  );
}
