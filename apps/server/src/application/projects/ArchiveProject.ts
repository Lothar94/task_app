import { ConflictError } from '../../domain/errors/DomainError.js';
import type { Project } from '../../domain/project/Project.js';
import type { Clock } from '../ports/Clock.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireProject } from '../shared/lookups.js';

/** Makes a project read-only. Idempotent, but refused while tasks are running or queued. */
export class ArchiveProject {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: Clock,
  ) {}

  execute(projectId: string): Project {
    const project = requireProject(this.projects, projectId);
    if (project.isArchived) return project;
    if (this.tasks.hasActiveRootTask(projectId) || this.tasks.findQueued(projectId).length > 0) {
      throw new ConflictError('Project has running or queued tasks: cancel them before archiving');
    }
    project.archive(this.clock.now());
    this.projects.save(project);
    return project;
  }
}
