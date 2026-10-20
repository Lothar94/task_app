import type { ResumeProjectResultDto } from '@fleet/shared';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireActiveProject } from '../shared/lookups.js';
import { toTaskDto } from '../shared/dtos.js';
import type { TaskQueue } from '../tasks/TaskQueue.js';
import type { TaskRecorder } from '../tasks/TaskRecorder.js';
import { classifyFailure } from './classifyFailure.js';

/** Re-queues the failed root tasks that stopped on a session or token limit, oldest first. */
export class ResumeProject {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly queue: TaskQueue,
  ) {}

  execute(projectId: string): ResumeProjectResultDto {
    requireActiveProject(this.projects, projectId);
    const recoverable = this.tasks
      .findByProject(projectId)
      .filter(
        (task) =>
          task.status === 'failed' &&
          task.parentTaskId === null &&
          classifyFailure(task.resultSummary) !== null,
      )
      .sort((a, b) => a.toSnapshot().createdAt.getTime() - b.toSnapshot().createdAt.getTime());
    for (const task of recoverable) {
      task.requeue(this.queue.nextPosition(projectId));
      this.recorder.recordChange(task);
    }
    if (recoverable.length > 0) this.queue.process(projectId);
    const requeued = recoverable.map((task) => this.tasks.findById(task.id) ?? task);
    return { requeued: requeued.map(toTaskDto) };
  }
}
