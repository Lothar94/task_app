import type { FleetStatusDto } from '@fleet/shared';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { buildFleetStatus } from './buildFleetStatus.js';

/** Status bar data: how busy the agents of one organization are right now. */
export class GetFleetStatus {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
    private readonly version: string,
  ) {}

  execute(organizationId: string): FleetStatusDto {
    requireOrganization(this.organizations, organizationId);
    const tasks = this.projects
      .findByOrganization(organizationId)
      .flatMap((project) => this.tasks.findByProject(project.id));
    return buildFleetStatus({
      agents: this.agents.findByOrganization(organizationId).map((agent) => agent.toSnapshot()),
      tasks: tasks.map((task) => task.toSnapshot()),
      version: this.version,
      now: this.clock.now(),
    });
  }
}
