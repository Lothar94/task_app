import type { DashboardDto, DashboardFilters } from '@fleet/shared';
import { NotFoundError } from '../../domain/errors/DomainError.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { buildDashboard } from './buildDashboard.js';

/** Usage of one organization; a project filter from another organization is reported as not found. */
export class GetUsageDashboard {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly tasks: TaskRepository,
    private readonly runs: TaskRunRepository,
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  execute(organizationId: string, filters: DashboardFilters): DashboardDto {
    requireOrganization(this.organizations, organizationId);
    const projects = this.projects.findByOrganization(organizationId);
    if (filters.projectId && !projects.some((project) => project.id === filters.projectId)) {
      throw new NotFoundError('Project', filters.projectId);
    }
    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = this.tasks.findAll().filter((task) => projectIds.has(task.projectId));
    const taskIds = new Set(tasks.map((task) => task.id));
    return buildDashboard({
      tasks,
      runs: this.runs.findAll().filter((run) => taskIds.has(run.taskId)),
      agents: this.agents.findByOrganization(organizationId),
      projects,
      filters,
      now: this.clock.now(),
    });
  }
}
