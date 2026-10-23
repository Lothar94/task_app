import type { PlanUsageDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanUsageUnavailableError } from '../../src/application/ports/PlanUsageSource.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { FakePlanUsageSource, SAMPLE_READING } from '../support/FakePlanUsageSource.js';
import { createTestFleet } from '../support/testFleet.js';

describe('GET /api/plan-usage', () => {
  let app: FastifyInstance;

  afterEach(() => app.close());

  async function getPlanUsage(source: FakePlanUsageSource) {
    const fleet = createTestFleet({}, 4, [], [], { planUsageSource: source });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const response = await app.inject({ method: 'GET', url: '/api/plan-usage' });
    return { status: response.statusCode, body: response.json<PlanUsageDto>() };
  }

  it('answers 200 with the plan usage windows', async () => {
    const { status, body } = await getPlanUsage(new FakePlanUsageSource());

    expect(status).toBe(200);
    expect(body).toEqual({
      available: true,
      reason: null,
      ...SAMPLE_READING,
      fetchedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });
  });

  it('answers 200 with available false and the reason when the usage cannot be read', async () => {
    const { status, body } = await getPlanUsage(
      new FakePlanUsageSource(new PlanUsageUnavailableError('no_credentials', 'none')),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      available: false,
      reason: 'no_credentials',
      subscriptionType: null,
      session: null,
      weekly: null,
      fetchedAt: null,
    });
  });
});
