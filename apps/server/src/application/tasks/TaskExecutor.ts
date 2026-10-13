import type { Task } from '../../domain/task/Task.js';

export interface ExecutionOptions {
  followUpMessage?: string;
  parentSignal?: AbortSignal;
}

export interface TaskExecutor {
  execute(taskId: string, options?: ExecutionOptions): Promise<Task>;
}
