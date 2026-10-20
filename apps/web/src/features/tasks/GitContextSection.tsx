import type { GitCommitRef, TaskGitContextDto } from '@fleet/shared';
import type { ReactNode } from 'react';
import { ErrorMessage, Loading } from '../../components/ui';
import { fileName, type GitContextOk, shortSha } from './gitContextModel';
import { InspectorSection } from './InspectorSection';
import { useTaskGit } from './taskQueries';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="label-mono text-fg-subtle">{label}</dt>
      <dd className="min-w-0 text-right font-mono text-xs text-fg [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const Commit = ({ commit }: { commit: GitCommitRef }) => (
  <>
    {shortSha(commit.sha)}
    {commit.branch && <span className="text-fg-subtle"> · {commit.branch}</span>}
  </>
);

function FileList({ files }: { files: GitContextOk['files'] }) {
  if (files.length === 0) return <p className="text-sm text-fg-subtle">Sin cambios entre base y head.</p>;
  return (
    <ul className="space-y-1 font-mono text-xs">
      {files.map((file) => (
        <li key={file.path} className="flex items-baseline justify-between gap-2">
          <span title={file.path} className="min-w-0 truncate text-fg-muted">
            {fileName(file.path)}
          </span>
          <span className="shrink-0">
            {file.additions === null || file.deletions === null ? (
              <span className="text-fg-subtle">bin</span>
            ) : (
              <>
                <span className="text-success">+{file.additions}</span>{' '}
                <span className="text-danger">−{file.deletions}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Body of the "Contexto Git & rama" section for each git status. */
export function GitContextBody({ git }: { git: TaskGitContextDto }) {
  if (git.status === 'not_a_repository') {
    return <p className="text-sm text-fg-subtle">El workspace del proyecto no es un repositorio git.</p>;
  }
  if (git.status === 'no_snapshot') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-fg-subtle">
          Sin instantánea git: la tarea no se ha ejecutado desde que se registra.
        </p>
        {git.currentBranch && (
          <dl>
            <Row label="Rama activa">{git.currentBranch}</Row>
          </dl>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <dl className="space-y-1.5">
        <Row label="Rama activa">{git.currentBranch ?? '(HEAD desacoplado)'}</Row>
        <Row label="Commit base">
          <Commit commit={git.base} />
        </Row>
        <Row label="Head commit">
          <Commit commit={git.head} />
          {git.live && <span className="ml-2 rounded-sm border border-info/40 px-1 text-info">en vivo</span>}
        </Row>
      </dl>
      <div className="space-y-1.5 border-t border-line pt-2">
        <p className="label-mono text-fg-subtle">Archivos tocados: {git.files.length} modificados</p>
        <FileList files={git.files} />
      </div>
    </div>
  );
}

export function GitContextSection({ taskId }: { taskId: string }) {
  const { data, error } = useTaskGit(taskId);
  return (
    <InspectorSection title="Contexto Git & rama">
      {error ? <ErrorMessage error={error} /> : data ? <GitContextBody git={data} /> : <Loading />}
    </InspectorSection>
  );
}
