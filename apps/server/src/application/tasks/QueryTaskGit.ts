import { GIT_DIFF_MAX_BYTES, type TaskGitContextDto, type TaskGitDiffDto } from '@fleet/shared';
import { ConflictError } from '../../domain/errors/DomainError.js';
import type { GitWorkspace } from '../ports/GitWorkspace.js';
import { type GitScope, type GitScopeResolver } from './GitScope.js';

/** The head to compare against: null means the working tree (while the task runs). */
const comparedHead = (scope: Extract<GitScope, { state: 'ok' }>) => (scope.live ? null : scope.head.sha);

export class GetTaskGitContext {
  constructor(
    private readonly scopes: GitScopeResolver,
    private readonly git: GitWorkspace,
  ) {}

  async execute(taskId: string): Promise<TaskGitContextDto> {
    const scope = await this.scopes.resolve(taskId);
    if (scope.state === 'not_a_repository') return { status: 'not_a_repository', taskId };
    if (scope.state === 'no_snapshot') {
      return { status: 'no_snapshot', taskId, currentBranch: scope.currentBranch };
    }
    const changes = await this.git.changedFiles(scope.workspacePath, scope.base.sha, comparedHead(scope));
    return {
      status: 'ok',
      taskId,
      currentBranch: scope.currentBranch,
      base: scope.base,
      head: scope.head,
      files: [...changes].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      live: scope.live,
    };
  }
}

export class GetTaskGitDiff {
  constructor(
    private readonly scopes: GitScopeResolver,
    private readonly git: GitWorkspace,
  ) {}

  async execute(taskId: string): Promise<TaskGitDiffDto> {
    const scope = await this.scopes.resolve(taskId);
    if (scope.state !== 'ok') throw new ConflictError(`Task "${taskId}" has no git context to diff`);
    const headSha = comparedHead(scope);
    const { patch, truncated } = await this.git.diff(
      scope.workspacePath,
      scope.base.sha,
      headSha,
      GIT_DIFF_MAX_BYTES,
    );
    return { taskId, baseSha: scope.base.sha, headSha, patch, truncated };
  }
}
