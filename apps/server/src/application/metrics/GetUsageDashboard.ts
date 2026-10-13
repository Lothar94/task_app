import type { DashboardDto, DashboardFilters } from '@fleet/shared';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import { requireProject } from '../shared/lookups.js';
import { buildDashboard } from './buildDashboard.js';

export class GetUsageDashboard {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly runs: TaskRunRepository,
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  execute(filters: DashboardFilters): DashboardDto {
    if (filters.projectId) requireProject(this.projects, filters.projectId);
    return buildDashboard({
      tasks: this.tasks.findAll(),
      runs: this.runs.findAll(),
      agents: this.agents.findAll(),
      projects: this.projects.findAll(),
      filters,
      now: this.clock.now(),
    });
  }
}
