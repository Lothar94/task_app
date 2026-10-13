import type { Project } from '../../domain/project/Project.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import { requireAgents, requireProject } from '../shared/lookups.js';

export class SetProjectMembers {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly agents: AgentRepository,
  ) {}

  execute(projectId: string, memberIds: string[]): Project {
    const project = requireProject(this.projects, projectId);
    requireAgents(this.agents, memberIds);
    project.setMembers(memberIds);
    this.projects.save(project);
    return project;
  }
}
