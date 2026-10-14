import type { Project } from '../../domain/project/Project.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireOrganization, requireProject } from '../shared/lookups.js';

export class ListProjects {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  execute(organizationId: string): Project[] {
    requireOrganization(this.organizations, organizationId);
    return this.projects.findByOrganization(organizationId);
  }
}

export class GetProject {
  constructor(private readonly projects: ProjectRepository) {}

  execute(projectId: string): Project {
    return requireProject(this.projects, projectId);
  }
}
