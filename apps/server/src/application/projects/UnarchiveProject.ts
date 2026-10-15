import type { Project } from '../../domain/project/Project.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import { requireProject } from '../shared/lookups.js';

/** Makes an archived project editable again. Idempotent. */
export class UnarchiveProject {
  constructor(private readonly projects: ProjectRepository) {}

  execute(projectId: string): Project {
    const project = requireProject(this.projects, projectId);
    if (!project.isArchived) return project;
    project.unarchive();
    this.projects.save(project);
    return project;
  }
}
