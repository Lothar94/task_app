import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DashboardDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { loadConfig } from '../../src/main/config.js';
import { createContainer } from '../../src/main/container.js';
import { FakeAgentRuntime } from '../support/FakeAgentRuntime.js';
import { FakeGitWorkspace } from '../support/FakeGitWorkspace.js';
import {
  FakeInstructionWriter,
  TEST_APP_VERSION,
  createTeamProject,
  eventually,
  fakeSkillSupport,
} from '../support/testFleet.js';

/** The fake runtime reports 100 in / 50 out / 1000 cache read / 10 cache write tokens of "claude-sonnet" per run. */
const SONNET_OVERRIDE = {
  match: 'claude-sonnet',
  pricing: { inputPerMTok: 4, outputPerMTok: 20, cacheWritePerMTok: 5, cacheReadPerMTok: 0.4 },
};
const DEFAULT_SONNET_COST = 0.0013875; // 3 / 15 / 3.75 / 0.3 per MTok
const OVERRIDE_SONNET_COST = 0.00185;
const OVERRIDE_SAVINGS = 0.0036; // 1000 cache reads at (4 - 0.4) per MTok

describe('dashboard over HTTP with MODEL_PRICING_FILE (QA)', () => {
  let app: FastifyInstance;

  afterEach(() => app.close());

  async function dashboardWith(env: NodeJS.ProcessEnv, query: string): Promise<DashboardDto> {
    const fleet = createContainer({
      db: openDatabase(':memory:'),
      runtime: new FakeAgentRuntime({}),
      instructionWriter: new FakeInstructionWriter(),
      ...fakeSkillSupport(),
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      git: new FakeGitWorkspace(),
      maxDelegationDepth: 4,
      appVersion: TEST_APP_VERSION,
      reservedPorts: [],
      modelPrices: loadConfig(env).modelPrices,
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, project } = await createTeamProject({ useCases: fleet.useCases } as never, []);
    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'priced',
      description: 'priced',
      start: 'now',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
    const response = await app.inject({ method: 'GET', url: `/api/organizations/default/dashboard?${query}` });
    expect(response.statusCode).toBe(200);
    return response.json<DashboardDto>();
  }

  const pricingFile = (content: string) => {
    const path = join(mkdtempSync(join(tmpdir(), 'vega-pricing-')), 'prices.json');
    writeFileSync(path, content);
    return path;
  };

  it('prices runs with the built-in table by default', async () => {
    const dashboard = await dashboardWith({}, 'days=1');
    expect(dashboard.totals.costUsd).toBeCloseTo(DEFAULT_SONNET_COST, 10);
    expect(dashboard.byModel[0]?.pricing?.inputPerMTok).toBe(3);
  });

  it('prices runs with the override file, including cache savings and the hourly chart', async () => {
    const env = { MODEL_PRICING_FILE: pricingFile(JSON.stringify([SONNET_OVERRIDE])) };
    const dashboard = await dashboardWith(env, 'days=1');
    expect(dashboard.totals.costUsd).toBeCloseTo(OVERRIDE_SONNET_COST, 10);
    expect(dashboard.totals.cacheSavingsUsd).toBeCloseTo(OVERRIDE_SAVINGS, 10);
    expect(dashboard.byModel[0]?.cost.cacheReadUsd).toBeCloseTo(0.0004, 10);
    expect(dashboard.activityGranularity).toBe('hour');
    expect(dashboard.daily).toHaveLength(24);
    expect(dashboard.previous?.runs).toBe(0);
    expect(dashboard.errorsTotal).toBe(0);
  });

  it('keeps previous null for all time', async () => {
    expect((await dashboardWith({}, '')).previous).toBeNull();
  });

  it('refuses to start with an invalid pricing file', () => {
    expect(() => loadConfig({ MODEL_PRICING_FILE: pricingFile('[{"match":"x"}]') })).toThrow(
      /Invalid MODEL_PRICING_FILE/,
    );
  });
});
