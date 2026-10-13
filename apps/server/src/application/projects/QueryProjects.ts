import type { Project } from '../../domain/project/Project.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import { requireProject } from '../shared/lookups.js';

export class ListProjects {
  constructor(private readonly projects: ProjectRepository) {}

  execute(): Project[] {
    return this.projects.findAll();
  }
}

export class GetProject {
  constructor(private readonly projects: ProjectRepository) {}

  execute(projectId: string): Project {
    return requireProject(this.projects, projectId);
  }
}
