import { ValidationError } from '../../domain/errors/DomainError.js';
import type { Task } from '../../domain/task/Task.js';
import type { EventSubscriber, Unsubscribe } from '../ports/EventBus.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskLauncher } from './TaskLauncher.js';
import type { TaskRecorder } from './TaskRecorder.js';

/**
 * Per-project queue of tasks. The queue runs one root task at a time: whenever the project has no
 * active root task, the first queued task starts, whatever the outcome of the previous one was.
 */
export class TaskQueue {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly launcher: TaskLauncher,
  ) {}

  /** Position a task appended to the queue of the project would get. */
  nextPosition(projectId: string): number {
    return this.tasks.findQueued(projectId).length + 1;
  }

  /** Starts the next queued task of the project if nothing else is running there. */
  process(projectId: string): void {
    if (this.tasks.hasActiveRootTask(projectId)) return;
    const next = this.tasks.findQueued(projectId)[0];
    if (!next) return;
    // Launching moves the task to running synchronously, so the project counts as busy right away.
    this.launcher.launch(next.id);
    this.compact(projectId);
  }

  processAll(): void {
    for (const projectId of this.tasks.findProjectIdsWithQueue()) this.process(projectId);
  }

  /** Re-triggers the queue whenever a root task of a project stops. */
  watch(events: EventSubscriber): Unsubscribe {
    return events.subscribe((event) => {
      if (event.type !== 'task.updated') return;
      const { task } = event;
      if (task.parentTaskId !== null) return;
      if (task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled') return;
      // Deferred so the finishing execution unwinds before the next one starts.
      queueMicrotask(() => this.process(task.projectId));
    });
  }

  /** Reassigns positions 1..n following `taskIds`, which must be exactly the queued tasks. */
  reorder(projectId: string, taskIds: readonly string[]): Task[] {
    const queued = this.tasks.findQueued(projectId);
    const byId = new Map(queued.map((task) => [task.id, task]));
    const isExactSet = taskIds.length === queued.length && new Set(taskIds).size === queued.length;
    if (!isExactSet || !taskIds.every((id) => byId.has(id))) {
      throw new ValidationError('taskIds must list exactly the tasks queued in the project, once each');
    }
    const ordered = taskIds.map((id) => byId.get(id) as Task);
    this.assignPositions(ordered);
    this.process(projectId);
    return ordered;
  }

  /** Closes the gaps left in the queue after a task leaves it. */
  compact(projectId: string): void {
    this.assignPositions(this.tasks.findQueued(projectId));
  }

  private assignPositions(ordered: Task[]): void {
    ordered.forEach((task, index) => {
      if (task.queuePosition === index + 1) return;
      task.moveInQueue(index + 1);
      this.recorder.recordChange(task);
    });
  }
}
