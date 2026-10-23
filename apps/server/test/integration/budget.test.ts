import type { BudgetDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;
/** Cost of one fake run (100 in / 50 out / 1000 cache read / 10 cache write sonnet tokens) at list prices. */
const DEFAULT_SONNET_COST = 0.0013875;

describe('monthly budget over HTTP', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;

  async function start(monthlyBudgetUsd: number | null = null) {
    fleet = createTestFleet({}, 4, [], [], { monthlyBudgetUsd });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  }
  afterEach(() => app.close());

  async function completeTaskIn(organizationId: string) {
    const { cto, project } = await createTeamProject(fleet, [], organizationId);
    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'T',
      description: 'D',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
  }

  const budgetOf = (organizationId: string) =>
    app.inject({ method: 'GET', url: `/api/organizations/${organizationId}/budget` });

  it('reports the month-to-date cost, priced like the dashboard, against the configured limit', async () => {
    await start(50);
    await completeTaskIn(ORG);

    const response = await budgetOf(ORG);

    expect(response.statusCode).toBe(200);
    const budget: BudgetDto = response.json();
    expect(budget).toMatchObject({ month: new Date().toISOString().slice(0, 7), monthlyLimitUsd: 50 });
    expect(budget.monthToDateCostUsd).toBeCloseTo(DEFAULT_SONNET_COST, 10);
  });

  it('reports no limit by default and only counts the organization own runs', async () => {
    await start();
    await completeTaskIn(fleet.useCases.createOrganization.execute('Other').id);

    expect((await budgetOf(ORG)).json()).toMatchObject({ monthToDateCostUsd: 0, monthlyLimitUsd: null });
  });

  it('answers 404 for an unknown organization', async () => {
    await start();
    expect((await budgetOf('ghost')).statusCode).toBe(404);
  });
});
