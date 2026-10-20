import type { ActiveSubtaskDto } from '@fleet/shared';
import { Link } from 'react-router';
import { FOCUS_RING } from '../../components/ui';
import { formatDuration } from '../../lib/format';

/** Extra table row under a project: the task an agent is working on, with its elapsed time. */
export function ActiveSubtaskRow({
  projectId,
  subtask,
  now,
  tint,
}: {
  projectId: string;
  subtask: ActiveSubtaskDto;
  now: number;
  tint: string;
}) {
  const elapsedMs = Math.max(0, now - Date.parse(subtask.startedAt));
  return (
    <tr className={`block border-b border-line px-4 pb-4 last:border-b-0 md:table-row md:p-0 ${tint}`}>
      <td colSpan={5} className="block md:table-cell md:px-4 md:pb-3.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-info pl-3 font-mono text-xs text-fg-subtle">
          <span>
            <span className="text-fg-muted">Subtarea activa:</span>{' '}
            <span className="font-medium text-fg">
              #{subtask.taskNumber} {subtask.title}
            </span>{' '}
            → Agente <span className="text-info">{subtask.agentName}</span>
          </span>
          <span aria-label="Tiempo transcurrido">{formatDuration(elapsedMs)}</span>
          <Link
            to={`/projects/${projectId}/tasks/${subtask.taskId}`}
            className={`text-accent underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            Ver traza en vivo
          </Link>
        </p>
      </td>
    </tr>
  );
}
