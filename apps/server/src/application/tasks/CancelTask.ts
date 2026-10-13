import type { Task } from '../../domain/task/Task.js';
import type { Clock } from '../ports/Clock.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireTask } from '../shared/lookups.js';
import type { TaskQueue } from './TaskQueue.js';
import type { RunningTasks } from './RunningTasks.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** Stops a task and every subtask it delegated. */
export class CancelTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly running: RunningTasks,
    private readonly recorder: TaskRecorder,
    private readonly clock: Clock,
    private readonly queue: TaskQueue,
  ) {}

  execute(taskId: string): void {
    const task = requireTask(this.tasks, taskId);
    this.cancelTree(task);
    this.queue.compact(task.projectId);
  }

  private cancelTree(task: Task): void {
    for (const child of this.tasks.findChildren(task.id)) this.cancelTree(child);
    if (task.isFinished) return;
    if (this.running.isRunning(task.id)) {
      // The execution owns the task and records the cancellation when it unwinds.
      this.running.abort(task.id);
      return;
    }
    task.cancel(this.clock.now());
    this.recorder.recordChange(task);
  }
}
