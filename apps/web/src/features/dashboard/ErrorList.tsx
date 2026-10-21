import type { RunErrorRow } from '@fleet/shared';
import { CircleX, RotateCcw } from 'lucide-react';
import { Link } from 'react-router';
import { Button, FOCUS_RING, StatusChip } from '../../components/ui';
import { CAUSE_LABELS } from './dashboardModel';
import { formatDistanceLabel } from './timeAgo';

export function ErrorList({
  errors,
  onRetry,
}: {
  errors: RunErrorRow[];
  onRetry: (error: RunErrorRow) => void;
}) {
  if (errors.length === 0) {
    return <p className="text-sm text-fg-subtle">Ninguna ejecución ha fallado en este periodo.</p>;
  }
  return (
    <ul className="space-y-3">
      {errors.map((error) => (
        <li
          key={error.runId}
          className="rounded-sm border border-line border-l-2 border-l-danger bg-surface-raised/40 p-3"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <CircleX aria-hidden className="size-4 text-danger" />
            <Link
              to={`/projects/${error.projectId}/tasks/${error.taskId}`}
              className={`font-medium text-fg hover:text-accent ${FOCUS_RING}`}
            >
              Tarea {error.taskNumber}: {error.taskTitle}
            </Link>
            <StatusChip tone="danger">{CAUSE_LABELS[error.cause]}</StatusChip>
            {error.retryable && (
              <Button
                variant="secondary"
                className="ml-auto"
                aria-label={`Reintentar tarea ${error.taskNumber}: ${error.taskTitle}`}
                onClick={() => onRetry(error)}
              >
                <RotateCcw aria-hidden className="size-3.5" />
                Reintentar
              </Button>
            )}
            <span className="w-full font-mono text-xs text-fg-subtle">
              {error.projectName} · {error.agentName} ·{' '}
              <time dateTime={error.occurredAt} title={new Date(error.occurredAt).toLocaleString()}>
                {formatDistanceLabel(error.occurredAt)}
              </time>
            </span>
          </div>
          <p className="mt-2 line-clamp-3 rounded-sm border border-line bg-canvas p-2 font-mono text-xs whitespace-pre-wrap text-danger [overflow-wrap:anywhere]">
            {error.error}
          </p>
        </li>
      ))}
    </ul>
  );
}
