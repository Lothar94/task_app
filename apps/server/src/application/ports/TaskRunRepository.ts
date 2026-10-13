import type { TaskRun } from '../../domain/task/TaskRun.js';

export interface TaskRunRepository {
  append(run: TaskRun): void;
  findByProject(projectId: string): TaskRun[];
  findAll(): TaskRun[];
}
