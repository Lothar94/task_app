import type { TaskRun } from '../../domain/task/TaskRun.js';

export interface TaskRunRepository {
  append(run: TaskRun): void;
  findByProject(projectId: string): TaskRun[];
  /** Runs of the given tasks, oldest start first. */
  findByTaskIds(taskIds: readonly string[]): TaskRun[];
  findAll(): TaskRun[];
}
