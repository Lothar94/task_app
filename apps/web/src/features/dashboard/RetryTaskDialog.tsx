import type { RunErrorRow } from '@fleet/shared';
import { Dialog } from '../../components/Dialog';
import { Button, ErrorMessage } from '../../components/ui';
import { useRetryTask } from '../tasks/taskQueries';

/** Asks for confirmation; only the confirm button re-queues the failed task. */
export function RetryTaskDialog({ error, onClose }: { error: RunErrorRow; onClose: () => void }) {
  const retry = useRetryTask();
  return (
    <Dialog open title={`Reintentar tarea ${error.taskNumber}`} onClose={onClose}>
      <p className="text-sm text-fg-muted">
        Se volverá a poner en cola, al final de la cola de {error.projectName}, la tarea fallida{' '}
        <span className="text-fg">
          {error.taskNumber}: {error.taskTitle}
        </span>
        .
      </p>
      <ErrorMessage error={retry.error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={retry.isPending}>
          Cancelar
        </Button>
        <Button disabled={retry.isPending} onClick={() => retry.mutate(error.taskId, { onSuccess: onClose })}>
          {retry.isPending ? 'Reintentando…' : 'Confirmar reintento'}
        </Button>
      </div>
    </Dialog>
  );
}
