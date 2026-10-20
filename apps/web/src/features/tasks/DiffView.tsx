import type { TaskGitDiffDto } from '@fleet/shared';
import { Dialog } from '../../components/Dialog';
import { ErrorMessage, Loading } from '../../components/ui';
import { type DiffLineKind, parseUnifiedDiff } from './diffModel';
import { useTaskGitDiff } from './taskQueries';

const LINE_STYLES: Record<DiffLineKind, string> = {
  add: 'bg-success/10 text-success',
  del: 'bg-danger/10 text-danger',
  context: 'text-fg-muted',
  meta: 'text-fg-subtle italic',
};

/** Renders a unified patch: one block per file, coloured +/− lines (sign included, not colour only). */
export function DiffViewer({ diff }: { diff: Pick<TaskGitDiffDto, 'patch' | 'truncated'> }) {
  const files = parseUnifiedDiff(diff.patch);
  return (
    <div className="space-y-3">
      {diff.truncated && (
        <p role="status" className="rounded-sm border border-warning/40 bg-warning/10 p-2 text-sm text-warning">
          Diff truncado: se muestra solo el principio del cambio.
        </p>
      )}
      {files.length === 0 && <p className="text-sm text-fg-subtle">Sin cambios entre base y head.</p>}
      {files.map((file) => (
        <section key={`${file.oldPath ?? ''}>${file.path}`} aria-label={file.path} className="rounded-md border border-line bg-canvas">
          <h3 className="border-b border-line px-3 py-1.5 font-mono text-xs text-fg [overflow-wrap:anywhere]">
            {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
          </h3>
          {file.isBinary && <p className="px-3 py-2 font-mono text-xs text-fg-subtle">Archivo binario</p>}
          {/* Focusable so keyboard users can scroll wide lines. */}
          <pre tabIndex={0} aria-label={`Cambios de ${file.path}`} className="overflow-x-auto py-1 font-mono text-xs leading-5 focus-visible:outline-2 focus-visible:outline-accent">
            {file.hunks.map((hunk) => (
              <code key={hunk.header} className="block">
                <span className="block px-3 text-info">{hunk.header}</span>
                {hunk.lines.map((line, index) => (
                  <span key={`${index}-${line.text}`} className={`block px-3 whitespace-pre ${LINE_STYLES[line.kind]}`}>
                    {line.text}
                  </span>
                ))}
              </code>
            ))}
          </pre>
        </section>
      ))}
    </div>
  );
}

/** Modal diff view; the patch is requested only while it is open. */
export function GitDiffDialog({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const { data, error } = useTaskGitDiff(taskId, open);
  return (
    <Dialog open={open} title="Cambios de la tarea" onClose={onClose}>
      <div className="max-h-[70dvh] overflow-y-auto">
        {error ? <ErrorMessage error={error} /> : data ? <DiffViewer diff={data} /> : <Loading />}
      </div>
    </Dialog>
  );
}
