import type { Task } from '../../domain/task/Task.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireRootTask } from '../shared/lookups.js';
import type { TaskQueue } from './TaskQueue.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** Takes a queued task out of the queue, back to draft. */
export class DequeueTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly queue: TaskQueue,
  ) {}

  execute(taskId: string): Task {
    const task = requireRootTask(this.tasks, taskId);
    task.dequeue();
    this.recorder.recordChange(task);
    this.queue.compact(task.projectId);
    return task;
  }
}
