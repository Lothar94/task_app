import type { AgentActivityDto } from '@fleet/shared';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { buildAgentActivity } from './buildAgentActivity.js';

/** Org chart data: which agents of one organization are working or delegating right now. */
export class GetAgentActivity {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
  ) {}

  execute(organizationId: string): AgentActivityDto {
    requireOrganization(this.organizations, organizationId);
    const tasks = this.projects
      .findByOrganization(organizationId)
      .flatMap((project) => this.tasks.findByProject(project.id));
    return buildAgentActivity(
      organizationId,
      this.agents.findByOrganization(organizationId),
      tasks.map((task) => task.toSnapshot()),
      this.clock.now(),
    );
  }
}
