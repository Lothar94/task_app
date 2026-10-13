import type { Task } from '../../domain/task/Task.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import { requireProject } from '../shared/lookups.js';
import type { TaskQueue } from './TaskQueue.js';

/** The project manager sets the order in which queued tasks run. */
export class ReorderQueue {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly queue: TaskQueue,
  ) {}

  execute(projectId: string, taskIds: string[]): Task[] {
    requireProject(this.projects, projectId);
    return this.queue.reorder(projectId, taskIds);
  }
}
