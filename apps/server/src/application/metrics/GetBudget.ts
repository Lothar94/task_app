import type { BudgetDto } from '@fleet/shared';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import type { ModelPriceTable } from './ModelPriceTable.js';
import { estimatedTotalsOfRun } from './usageMath.js';

const startOfUtcMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

/** Month-to-date spending of an organization, estimated like the dashboard, against the monthly limit. */
export class GetBudget {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly runs: TaskRunRepository,
    private readonly clock: Clock,
    private readonly prices: ModelPriceTable,
    private readonly monthlyLimitUsd: number | null,
  ) {}

  execute(organizationId: string): BudgetDto {
    requireOrganization(this.organizations, organizationId);
    const now = this.clock.now();
    const monthStart = startOfUtcMonth(now);
    const taskIds = new Set(
      this.projects
        .findByOrganization(organizationId)
        .flatMap((project) => this.tasks.findByProject(project.id))
        .map((task) => task.id),
    );
    const costs = this.runs
      .findAll()
      .filter((run) => taskIds.has(run.taskId) && run.finishedAt >= monthStart && run.finishedAt <= now)
      .map((run) => estimatedTotalsOfRun(run, this.prices).costUsd);
    return {
      month: now.toISOString().slice(0, 7),
      monthToDateCostUsd: costs.reduce((total, cost) => total + cost, 0),
      monthlyLimitUsd: this.monthlyLimitUsd,
    };
  }
}
