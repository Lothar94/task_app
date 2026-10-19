import type { RunErrorRow } from '@fleet/shared';
import { CircleX } from 'lucide-react';
import { Link } from 'react-router';
import { formatDistanceLabel } from './timeAgo';

export function ErrorList({ errors }: { errors: RunErrorRow[] }) {
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
              className="font-medium text-fg hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Tarea {error.taskNumber}: {error.taskTitle}
            </Link>
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
