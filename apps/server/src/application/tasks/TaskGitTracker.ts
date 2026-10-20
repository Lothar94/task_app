import type { Logger } from '../ports/Logger.js';
import type { GitWorkspace } from '../ports/GitWorkspace.js';
import type { TaskGitSnapshotRepository } from '../ports/TaskGitSnapshotRepository.js';

/** Snapshots the workspace's HEAD around a task's runs. Best effort: git problems never fail a run. */
export class TaskGitTracker {
  constructor(
    private readonly git: GitWorkspace,
    private readonly snapshots: TaskGitSnapshotRepository,
    private readonly logger: Logger,
  ) {}

  /** Captures HEAD as the task's base, unless an earlier run already did. */
  async captureBase(taskId: string, workspacePath: string): Promise<void> {
    await this.bestEffort('base', taskId, async () => {
      if (this.snapshots.find(taskId)) return;
      const base = await this.git.head(workspacePath);
      if (base) this.snapshots.save({ taskId, base, head: null });
    });
  }

  /** Captures HEAD as the task's head; needs a base, so it does nothing without one. */
  async captureHead(taskId: string, workspacePath: string): Promise<void> {
    await this.bestEffort('head', taskId, async () => {
      const snapshot = this.snapshots.find(taskId);
      const head = snapshot ? await this.git.head(workspacePath) : null;
      if (snapshot && head) this.snapshots.save({ ...snapshot, head });
    });
  }

  private async bestEffort(what: string, taskId: string, capture: () => Promise<void>): Promise<void> {
    try {
      await capture();
    } catch (error) {
      this.logger.error(`Could not capture the git ${what} of task ${taskId}`, error);
    }
  }
}
