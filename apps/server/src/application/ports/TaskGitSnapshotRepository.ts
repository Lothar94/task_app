import type { GitCommitRef } from '@fleet/shared';

/** Where the workspace's HEAD was when a task's first run started and when its last run ended. */
export interface TaskGitSnapshot {
  taskId: string;
  base: GitCommitRef;
  /** null until a run of the task finishes. */
  head: GitCommitRef | null;
}

export interface TaskGitSnapshotRepository {
  find(taskId: string): TaskGitSnapshot | null;
  /** Inserts or replaces the snapshot of the task. */
  save(snapshot: TaskGitSnapshot): void;
}
