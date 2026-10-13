import type { Logger } from '../ports/Logger.js';
import type { ExecutionOptions, TaskExecutor } from './TaskExecutor.js';

/** Starts task executions in the background so requests return immediately. */
export class TaskLauncher {
  constructor(
    private readonly executor: TaskExecutor,
    private readonly logger: Logger,
  ) {}

  launch(taskId: string, options?: ExecutionOptions): void {
    this.executor.execute(taskId, options).catch((error: unknown) => {
      this.logger.error(`Task ${taskId} could not be executed`, error);
    });
  }
}
