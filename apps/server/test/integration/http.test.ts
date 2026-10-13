import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTestFleet, profile } from '../support/testFleet.js';

describe('HTTP API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const fleet = createTestFleet();
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });

  afterEach(() => app.close());

  const createAgent = (name: string) =>
    app.inject({ method: 'POST', url: '/api/agents', payload: { ...profile(name), collaboratorIds: [] } });

  it('creates and lists agents', async () => {
    expect((await createAgent('CTO')).statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(list.json()).toMatchObject([{ name: 'CTO', model: 'sonnet' }]);
  });

  it('defaults the effort to high and rejects unknown levels', async () => {
    const { effort: _effort, ...withoutEffort } = profile('CTO');
    const created = await app.inject({ method: 'POST', url: '/api/agents', payload: withoutEffort });
    expect(created.json()).toMatchObject({ effort: 'high' });

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { ...profile('QA'), effort: 'extreme' },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('drafts instructions for a new agent', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/agents/instructions-draft',
      payload: { name: 'QA', role: 'Tester' },
    });
    expect(response.json()).toEqual({ instructions: 'Generated instructions for QA' });
  });

  it('rejects duplicated agent names with 409', async () => {
    await createAgent('CTO');
    expect((await createAgent('cto')).statusCode).toBe(409);
  });

  it('rejects invalid payloads with 400', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/agents', payload: { name: 'x' } });
    expect(response.statusCode).toBe(400);
  });

  it('serves the usage dashboard', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/dashboard?days=30' });
    expect(response.json()).toMatchObject({
      filters: { projectId: null, days: 30 },
      totals: { completed: 0 },
    });
    expect((await app.inject({ method: 'GET', url: '/api/dashboard?projectId=nope' })).statusCode).toBe(404);
  });

  it('returns 404 for unknown resources', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/projects/nope' })).statusCode).toBe(404);
  });

  it('requires an absolute workspace path for projects', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Demo', workspacePath: 'relative/path' },
    });
    expect(response.statusCode).toBe(400);
  });
});
