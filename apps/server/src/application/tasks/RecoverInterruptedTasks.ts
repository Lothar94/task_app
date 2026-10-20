import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRecorder } from './TaskRecorder.js';

const INTERRUPTED_REASON = 'Interrupted: the server stopped while the task was running';

/** Marks as failed the tasks left active by a previous server process, recording the failed run. */
export class RecoverInterruptedTasks {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(): number {
    const interrupted = this.tasks.findActive();
    for (const task of interrupted) {
      const now = this.clock.now();
      const startedAt = task.toSnapshot().startedAt;
      task.fail(INTERRUPTED_REASON, now);
      if (startedAt) {
        this.recorder.recordRun({
          id: this.ids.next(),
          taskId: task.id,
          startedAt,
          finishedAt: now,
          outcome: 'failed',
          error: INTERRUPTED_REASON,
          numTurns: null,
          llmMs: null,
          toolMs: null,
          models: [],
        });
      }
      this.recorder.recordChange(task);
    }
    return interrupted.length;
  }
}
