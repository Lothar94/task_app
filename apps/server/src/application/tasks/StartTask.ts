import type { Task } from '../../domain/task/Task.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireActiveProject, requirePlannedRootTask } from '../shared/lookups.js';
import type { TaskLauncher } from './TaskLauncher.js';
import type { TaskQueue } from './TaskQueue.js';

/** The project manager starts a draft or queued task right away, skipping the queue. */
export class StartTask {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly launcher: TaskLauncher,
    private readonly queue: TaskQueue,
  ) {}

  execute(taskId: string): Task {
    const task = requirePlannedRootTask(this.tasks, taskId);
    requireActiveProject(this.projects, task.projectId);
    this.launcher.launch(task.id);
    this.queue.compact(task.projectId);
    return this.tasks.findById(task.id) ?? task;
  }
}
