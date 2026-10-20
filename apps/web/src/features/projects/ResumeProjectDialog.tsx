import type { ProjectAlertDto } from '@fleet/shared';
import { Dialog } from '../../components/Dialog';
import { Button, ErrorMessage } from '../../components/ui';
import { alertText } from './projectAlertLabels';
import { useResumeProject } from './projectQueries';

/** Asks for confirmation; only the confirm button triggers the resume mutation. */
export function ResumeProjectDialog({
  projectId,
  projectName,
  alerts,
  onClose,
}: {
  projectId: string;
  projectName: string;
  alerts: ProjectAlertDto[];
  onClose: () => void;
}) {
  const resume = useResumeProject();
  return (
    <Dialog open title={`Reanudar ${projectName}`} onClose={onClose}>
      <p className="text-sm text-fg-muted">
        Se volverán a poner en cola, al final de la cola, estas tareas fallidas:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-fg">
        {alerts.map((alert) => (
          <li key={alert.kind}>{alertText(alert)}</li>
        ))}
      </ul>
      <ErrorMessage error={resume.error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={resume.isPending}>
          Cancelar
        </Button>
        <Button disabled={resume.isPending} onClick={() => resume.mutate(projectId, { onSuccess: onClose })}>
          {resume.isPending ? 'Reanudando…' : 'Confirmar reanudación'}
        </Button>
      </div>
    </Dialog>
  );
}
