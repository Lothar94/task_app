import { Project, type ProjectDetails } from '../../domain/project/Project.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { WorkspaceProvisioner } from '../ports/WorkspaceProvisioner.js';
import { requireAgents } from '../shared/lookups.js';

export interface CreateProjectCommand {
  details: ProjectDetails;
  memberIds: string[];
}

export class CreateProject {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly agents: AgentRepository,
    private readonly workspaces: WorkspaceProvisioner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute({ details, memberIds }: CreateProjectCommand): Project {
    requireAgents(this.agents, memberIds);
    const project = Project.create(this.ids.next(), details, memberIds, this.clock.now());
    this.workspaces.ensureExists(project.workspacePath);
    this.projects.save(project);
    return project;
  }
}
