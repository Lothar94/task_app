import type { ProjectsTelemetryDto } from '@fleet/shared';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { buildProjectsTelemetry } from './buildProjectsTelemetry.js';

/** Operational telemetry of every project of one organization, loaded in a single pass. */
export class GetProjectsTelemetry {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly tasks: TaskRepository,
    private readonly runs: TaskRunRepository,
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  execute(organizationId: string): ProjectsTelemetryDto {
    requireOrganization(this.organizations, organizationId);
    const projects = this.projects.findByOrganization(organizationId);
    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = this.tasks.findAll().filter((task) => projectIds.has(task.projectId));
    const taskIds = new Set(tasks.map((task) => task.id));
    return buildProjectsTelemetry({
      tasks,
      runs: this.runs.findAll().filter((run) => taskIds.has(run.taskId)),
      agents: this.agents.findByOrganization(organizationId),
      projects,
      now: this.clock.now(),
    });
  }
}
