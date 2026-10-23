import type { ModelTokenUsage } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { GetBudget } from '../../src/application/metrics/GetBudget.js';
import { ModelPriceTable } from '../../src/application/metrics/ModelPriceTable.js';
import type { OrganizationRepository } from '../../src/application/ports/OrganizationRepository.js';
import type { ProjectRepository } from '../../src/application/ports/ProjectRepository.js';
import type { TaskRepository } from '../../src/application/ports/TaskRepository.js';
import type { TaskRunRepository } from '../../src/application/ports/TaskRunRepository.js';
import { NotFoundError } from '../../src/domain/errors/DomainError.js';
import type { TaskRun } from '../../src/domain/task/TaskRun.js';

const now = new Date('2026-10-23T12:00:00.000Z');
/** Unknown models fall back to the cost reported by Claude Code. */
const usage = (costUsd: number): ModelTokenUsage => ({
  model: 'unpriced-model',
  inputTokens: 1,
  outputTokens: 1,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd,
});
const run = (taskId: string, finishedAt: string, costUsd: number): TaskRun => ({
  id: `${taskId}-${finishedAt}`,
  taskId,
  startedAt: new Date(finishedAt),
  finishedAt: new Date(finishedAt),
  outcome: 'completed',
  error: null,
  numTurns: 1,
  llmMs: null,
  toolMs: null,
  models: [usage(costUsd)],
});

function budgetWith(runs: TaskRun[], limit: number | null) {
  const organizations = {
    findById: (id: string) => (id === 'org' ? { id } : null),
  } as unknown as OrganizationRepository;
  const projects = { findByOrganization: () => [{ id: 'p1' }] } as unknown as ProjectRepository;
  const tasks = { findByProject: () => [{ id: 'mine' }] } as unknown as TaskRepository;
  const runRepository = { findAll: () => runs } as unknown as TaskRunRepository;
  return new GetBudget(
    organizations,
    projects,
    tasks,
    runRepository,
    { now: () => now },
    new ModelPriceTable(),
    limit,
  );
}

describe('GetBudget', () => {
  it('adds the runs of the organization finished in the current UTC month', () => {
    const budget = budgetWith(
      [
        run('mine', '2026-10-01T00:00:00.000Z', 1.5),
        run('mine', '2026-10-23T11:59:59.000Z', 2),
        run('mine', '2026-09-30T23:59:59.999Z', 100),
        run('other', '2026-10-10T00:00:00.000Z', 100),
      ],
      10,
    ).execute('org');

    expect(budget).toEqual({ month: '2026-10', monthToDateCostUsd: 3.5, monthlyLimitUsd: 10 });
  });

  it('reports zero and no limit for an organization without runs', () => {
    expect(budgetWith([], null).execute('org')).toEqual({
      month: '2026-10',
      monthToDateCostUsd: 0,
      monthlyLimitUsd: null,
    });
  });

  it('rejects unknown organizations', () => {
    expect(() => budgetWith([], null).execute('ghost')).toThrow(NotFoundError);
  });
});
