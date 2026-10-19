import type { TaskDto, TaskStatus } from '@fleet/shared';
import { CircleAlert, CircleCheck, CircleSlash, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Accordion } from '../../components/Accordion';
import { Markdown } from '../../components/Markdown';
import type { ChipTone } from '../../components/ui';

interface ResultStyle {
  label: string;
  tone: ChipTone;
  icon: ReactNode;
  iconClassName: string;
}

const RESULT_STYLES: Partial<Record<TaskStatus, ResultStyle>> = {
  completed: {
    label: 'Resultado de ejecución & entregables',
    tone: 'success',
    icon: <CircleCheck aria-hidden className="size-4 shrink-0" />,
    iconClassName: 'text-success',
  },
  failed: {
    label: 'La tarea ha fallado',
    tone: 'danger',
    icon: <CircleAlert aria-hidden className="size-4 shrink-0" />,
    iconClassName: 'text-danger',
  },
  cancelled: {
    label: 'Tarea cancelada',
    tone: 'neutral',
    icon: <CircleSlash aria-hidden className="size-4 shrink-0" />,
    iconClassName: 'text-fg-subtle',
  },
};
const IN_PROGRESS: ResultStyle = {
  label: 'Resultado provisional',
  tone: 'info',
  icon: <LoaderCircle aria-hidden className="size-4 shrink-0" />,
  iconClassName: 'text-info',
};

/**
 * Full-width, collapsible summary of what the agent delivered. It is remounted whenever the
 * summary changes (see the key in TaskWorkspace), so `defaultOpen` applies to each new result.
 */
export function ResultPanel({ task, defaultOpen = true }: { task: TaskDto; defaultOpen?: boolean }) {
  const { label, tone, icon, iconClassName } = RESULT_STYLES[task.status] ?? IN_PROGRESS;
  return (
    <Accordion
      defaultOpen={defaultOpen}
      bar={tone}
      bodyClassName="border-t border-line bg-canvas/40 px-5 py-4"
      header={
        <>
          <span className={iconClassName}>{icon}</span>
          <span className="text-sm font-semibold text-fg">{label}</span>
        </>
      }
    >
      <Markdown className="prose-base">{task.resultSummary ?? ''}</Markdown>
    </Accordion>
  );
}
