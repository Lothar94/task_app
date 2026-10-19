import type { TaskNodeDto } from '@fleet/shared';
import { Link } from 'react-router';
import { Button, Card, ErrorMessage } from '../../components/ui';
import { TaskLabels } from './TaskLabels';
import { moveItem } from './queueModel';
import { useDequeueTask, useReorderQueue, useStartTask } from './taskQueries';
import { TaskNumber } from './taskLabel';

interface QueueCardProps {
  projectId: string;
  queued: TaskNodeDto[];
  agentNames: Map<string, string>;
}

/** Queued tasks of the project in execution order, with controls to reorder, start or remove them. */
export function QueueCard({ projectId, queued, agentNames }: QueueCardProps) {
  const reorder = useReorderQueue(projectId);
  const start = useStartTask();
  const dequeue = useDequeueTask();
  const busy = reorder.isPending || start.isPending || dequeue.isPending;
  const move = (index: number, offset: -1 | 1) =>
    reorder.mutate(moveItem(queued, index, offset).map((task) => task.id));
  return (
    <Card title={`Cola (${queued.length})`}>
      <p className="mb-3 text-sm text-fg-subtle">
        Se ejecutan en orden, de una en una: la primera arranca cuando el proyecto no tiene ninguna tarea en
        curso.
      </p>
      <ol className="divide-y divide-line">
        {queued.map((task, index) => (
          <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
            <span className="w-6 text-right font-mono text-sm text-fg-muted" aria-hidden>
              {index + 1}.
            </span>
            <Link
              to={`/projects/${projectId}/tasks/${task.id}`}
              className="flex min-w-0 flex-1 items-start gap-2"
            >
              <TaskNumber number={task.number} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium hover:text-accent">{task.title}</span>
                <span className="text-xs text-fg-subtle">
                  {agentNames.get(task.agentId) ?? 'Agente eliminado'}
                </span>
                <TaskLabels milestone={task.milestone} tags={task.tags} />
              </span>
            </Link>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                aria-label={`Subir ${task.title} en la cola`}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
              >
                ↑ Subir
              </Button>
              <Button
                variant="secondary"
                aria-label={`Bajar ${task.title} en la cola`}
                disabled={busy || index === queued.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓ Bajar
              </Button>
              <Button
                aria-label={`Iniciar ahora ${task.title}`}
                disabled={busy}
                onClick={() => start.mutate(task.id)}
              >
                Iniciar ahora
              </Button>
              <Button
                variant="secondary"
                aria-label={`Quitar ${task.title} de la cola`}
                disabled={busy}
                onClick={() => dequeue.mutate(task.id)}
              >
                Quitar de la cola
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <ErrorMessage error={reorder.error ?? start.error ?? dequeue.error} />
    </Card>
  );
}
