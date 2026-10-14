import { ConflictError } from '../../domain/errors/DomainError.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireAgent } from '../shared/lookups.js';

export class DeleteAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: Clock,
  ) {}

  execute(agentId: string): void {
    const agent = requireAgent(this.agents, agentId);
    if (this.tasks.existsForAgent(agentId)) {
      throw new ConflictError(`Agent "${agent.name}" has tasks and cannot be deleted`);
    }
    this.detachFromTeammates(agent.organizationId, agentId);
    this.detachFromProjects(agentId);
    this.agents.delete(agentId);
  }

  private detachFromTeammates(organizationId: string, agentId: string): void {
    const now = this.clock.now();
    for (const teammate of this.agents.findByOrganization(organizationId)) {
      if (!teammate.canDelegateTo(agentId)) continue;
      teammate.removeCollaborator(agentId, now);
      this.agents.save(teammate);
    }
  }

  private detachFromProjects(agentId: string): void {
    for (const project of this.projects.findByMember(agentId)) {
      project.removeMember(agentId);
      this.projects.save(project);
    }
  }
}
