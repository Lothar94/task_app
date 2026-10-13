import type { RunErrorRow } from '@fleet/shared';
import { Link } from 'react-router';
import { formatDistanceLabel } from './timeAgo';

export function ErrorList({ errors }: { errors: RunErrorRow[] }) {
  if (errors.length === 0) {
    return <p className="text-sm text-zinc-500">✓ Ninguna ejecución ha fallado en este periodo.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-800/70">
      {errors.map((error) => (
        <li key={error.runId} className="py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span aria-hidden className="text-[var(--status-critical)]">
              ✕
            </span>
            <Link
              to={`/projects/${error.projectId}/tasks/${error.taskId}`}
              className="font-medium hover:text-indigo-300"
            >
              Tarea {error.taskNumber}: {error.taskTitle}
            </Link>
            <span className="text-xs text-zinc-500">
              {error.projectName} · {error.agentName} ·{' '}
              <time dateTime={error.occurredAt} title={new Date(error.occurredAt).toLocaleString()}>
                {formatDistanceLabel(error.occurredAt)}
              </time>
            </span>
          </div>
          <p className="mt-1 line-clamp-3 font-mono text-xs whitespace-pre-wrap text-red-300/90 [overflow-wrap:anywhere]">
            {error.error}
          </p>
        </li>
      ))}
    </ul>
  );
}
