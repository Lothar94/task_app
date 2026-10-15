import type { Task } from '../../domain/task/Task.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireActiveProject, requireRootTask } from '../shared/lookups.js';
import type { TaskQueue } from './TaskQueue.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** Appends a draft task to the end of its project queue. */
export class EnqueueTask {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly queue: TaskQueue,
  ) {}

  execute(taskId: string): Task {
    const task = requireRootTask(this.tasks, taskId);
    requireActiveProject(this.projects, task.projectId);
    task.enqueue(this.queue.nextPosition(task.projectId));
    this.recorder.recordChange(task);
    this.queue.process(task.projectId);
    return this.tasks.findById(task.id) ?? task;
  }
}
