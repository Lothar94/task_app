import type { GitFileChange, TaskDto, TaskExecutionDto, TaskGitContextDto } from '@fleet/shared';
import { formatCost, formatTokens } from '../../lib/format';

export type GitContextOk = Extract<TaskGitContextDto, { status: 'ok' }>;

export const isGitOk = (git: TaskGitContextDto | undefined): git is GitContextOk => git?.status === 'ok';

export const shortSha = (sha: string) => sha.slice(0, 7);

export const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

const changeCounts = (file: GitFileChange) =>
  file.additions === null || file.deletions === null ? 'bin' : `+${file.additions} −${file.deletions}`;

const commitLabel = (ref: GitContextOk['base']) =>
  `\`${shortSha(ref.sha)}\`${ref.branch ? ` (${ref.branch})` : ''}`;

/** Markdown pull-request text: title, summary, branch/base, file list and, when known, cost. */
export function buildPullRequestText(
  task: Pick<TaskDto, 'title' | 'resultSummary'>,
  git: GitContextOk,
  execution?: TaskExecutionDto,
): string {
  const lines = [`# ${task.title}`, '', task.resultSummary?.trim() || 'Sin resumen.', ''];
  lines.push('## Contexto git', '');
  lines.push(`- Rama: ${git.currentBranch ?? '(HEAD desacoplado)'}`);
  lines.push(`- Base: ${commitLabel(git.base)}`, `- Head: ${commitLabel(git.head)}`, '');
  lines.push(`## Archivos modificados (${git.files.length})`, '');
  if (git.files.length === 0) lines.push('Sin cambios entre base y head.');
  for (const file of git.files) lines.push(`- \`${file.path}\` ${changeCounts(file)}`);
  if (execution && execution.own.runs > 0) {
    lines.push(
      '',
      `Ejecución: ${formatTokens(execution.own.totalTokens)} tokens, coste estimado ${formatCost(execution.own.costUsd)}.`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export type CopyState = 'idle' | 'copied' | 'failed';

/** Writes `text` to the clipboard; never throws (unsupported API or denied permission → 'failed'). */
export async function copyToClipboard(text: string): Promise<CopyState> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
