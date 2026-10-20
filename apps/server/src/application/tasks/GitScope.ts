import type { GitCommitRef } from '@fleet/shared';
import { requireProject, requireTask } from '../shared/lookups.js';
import type { GitWorkspace } from '../ports/GitWorkspace.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskGitSnapshotRepository } from '../ports/TaskGitSnapshotRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';

export type GitScope =
  | { state: 'not_a_repository' }
  | { state: 'no_snapshot'; currentBranch: string | null }
  | {
      state: 'ok';
      workspacePath: string;
      currentBranch: string | null;
      base: GitCommitRef;
      head: GitCommitRef;
      live: boolean;
    };

/** Decides which two points of a repository a task's git context compares. */
export class GitScopeResolver {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly snapshots: TaskGitSnapshotRepository,
    private readonly git: GitWorkspace,
  ) {}

  /**
   * While the task runs, the scope ends at the live HEAD (plus the working tree). Afterwards it ends
   * at the head stored when the last run finished, or at the base when none was stored.
   */
  async resolve(taskId: string): Promise<GitScope> {
    const task = requireTask(this.tasks, taskId);
    const { workspacePath } = requireProject(this.projects, task.projectId);
    const current = await this.git.head(workspacePath);
    if (!current) return { state: 'not_a_repository' };
    const snapshot = this.snapshots.find(taskId);
    if (!snapshot) return { state: 'no_snapshot', currentBranch: current.branch };
    const live = task.status === 'running' || task.status === 'waiting_subtasks';
    return {
      state: 'ok',
      workspacePath,
      currentBranch: current.branch,
      base: snapshot.base,
      head: live ? current : (snapshot.head ?? snapshot.base),
      live,
    };
  }
}
