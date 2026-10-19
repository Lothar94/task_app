import type { ProjectDto } from '@fleet/shared';
import { Button, ErrorMessage } from '../../components/ui';
import { useSetProjectArchived } from './projectQueries';

export function ArchiveBanner({ onUnarchive, isPending }: { onUnarchive: () => void; isPending: boolean }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning"
    >
      <span>Proyecto archivado — solo lectura</span>
      <Button variant="secondary" onClick={onUnarchive} disabled={isPending}>
        Desarchivar
      </Button>
    </div>
  );
}

/** Archive toggle for the page header plus the archived banner and the error of the last attempt. */
export function useProjectArchive(project: ProjectDto) {
  const setArchived = useSetProjectArchived(project.id);
  const isArchived = project.archivedAt !== null;
  const archive = () => {
    if (window.confirm(`¿Archivar «${project.name}»? Pasará a ser de solo lectura.`)) {
      setArchived.mutate(true);
    }
  };
  return {
    isArchived,
    error: setArchived.error,
    button: isArchived ? null : (
      <Button variant="secondary" onClick={archive} disabled={setArchived.isPending}>
        Archivar
      </Button>
    ),
    banner: isArchived ? (
      <ArchiveBanner onUnarchive={() => setArchived.mutate(false)} isPending={setArchived.isPending} />
    ) : null,
  };
}

export const ArchiveError = ({ error }: { error: unknown }) =>
  error ? (
    <div className="mb-6">
      <ErrorMessage error={error} />
    </div>
  ) : null;
