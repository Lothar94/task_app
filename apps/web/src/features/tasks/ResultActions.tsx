import type { TaskDto, TaskExecutionDto } from '@fleet/shared';
import { Check, Copy, FileDiff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui';
import { GitDiffDialog } from './DiffView';
import { buildPullRequestText, type CopyState, copyToClipboard, type GitContextOk, isGitOk } from './gitContextModel';
import { useTaskExecution, useTaskGit } from './taskQueries';

const COPY_FEEDBACK: Record<CopyState, string> = { idle: '', copied: 'Copiado', failed: 'No se pudo copiar' };

interface ResultActionsViewProps {
  fileCount: number;
  copyState: CopyState;
  onCopy: () => void;
  onOpenDiff: () => void;
}

export function ResultActionsView({ fileCount, copyState, onCopy, onOpenDiff }: ResultActionsViewProps) {
  return (
    <>
      <span role="status" aria-live="polite" className={`font-mono text-xs ${copyState === 'failed' ? 'text-danger' : 'text-success'}`}>
        {COPY_FEEDBACK[copyState]}
      </span>
      <Button variant="secondary" className="py-1 text-xs" onClick={onCopy}>
        {copyState === 'copied' ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
        Copiar PR
      </Button>
      <Button variant="secondary" className="py-1 text-xs" onClick={onOpenDiff}>
        <FileDiff aria-hidden className="size-3.5" />
        Abrir diff ({fileCount} archivos)
      </Button>
    </>
  );
}

function ResultActionsForGit({ task, git, execution }: { task: TaskDto; git: GitContextOk; execution?: TaskExecutionDto }) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [isDiffOpen, setDiffOpen] = useState(false);
  const copy = async () => setCopyState(await copyToClipboard(buildPullRequestText(task, git, execution)));
  return (
    <>
      <ResultActionsView fileCount={git.files.length} copyState={copyState} onCopy={copy} onOpenDiff={() => setDiffOpen(true)} />
      <GitDiffDialog taskId={task.id} open={isDiffOpen} onClose={() => setDiffOpen(false)} />
    </>
  );
}

/** "Copiar PR" and "Abrir diff" for the result banner; rendered only when the task has a git context. */
export function ResultActions({ task }: { task: TaskDto }) {
  const git = useTaskGit(task.id);
  const execution = useTaskExecution(task.id);
  if (!isGitOk(git.data)) return null;
  return <ResultActionsForGit task={task} git={git.data} execution={execution.data} />;
}
