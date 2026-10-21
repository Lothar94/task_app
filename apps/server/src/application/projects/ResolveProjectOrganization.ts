import type { ProjectRepository } from '../ports/ProjectRepository.js';

/** Organization that owns a project, or null when the project does not exist. */
export class ResolveProjectOrganization {
  constructor(private readonly projects: ProjectRepository) {}

  execute(projectId: string): string | null {
    return this.projects.findById(projectId)?.organizationId ?? null;
  }
}
