import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTestFleet, profile } from '../support/testFleet.js';

describe('organizations API (QA regressions)', () => {
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

  const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object | undefined });

  it('accepts a 120-character name and rejects 121, on create and on rename', async () => {
    const created = await call('POST', '/api/organizations', { name: 'a'.repeat(120) });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    expect((await call('POST', '/api/organizations', { name: 'b'.repeat(121) })).statusCode).toBe(400);
    expect((await call('PUT', `/api/organizations/${id}`, { name: 'c'.repeat(120) })).statusCode).toBe(200);
    expect((await call('PUT', `/api/organizations/${id}`, { name: 'c'.repeat(121) })).statusCode).toBe(400);
    expect((await call('PUT', `/api/organizations/${id}`, { name: '' })).statusCode).toBe(400);
  });

  it('measures the length after trimming and keeps inner spaces', async () => {
    const padded = await call('POST', '/api/organizations', { name: `  ${'a'.repeat(120)}  ` });
    expect(padded.statusCode).toBe(201);

    const spaced = await call('POST', '/api/organizations', { name: ' My  Lab ' });
    expect(spaced.json().name).toBe('My  Lab');
  });

  it('answers 404 for unknown organizations on every nested route and for unknown ids on rename', async () => {
    expect((await call('PUT', '/api/organizations/nope', { name: 'x' })).statusCode).toBe(404);
    for (const path of ['agents', 'projects', 'dashboard']) {
      expect((await call('GET', `/api/organizations/nope/${path}`)).statusCode).toBe(404);
    }
    const body = { ...profile('Ghost') };
    expect((await call('POST', '/api/organizations/nope/agents', body)).statusCode).toBe(404);
  });

  it('rejects an unknown member with 404 and a foreign one with 400 when creating a project', async () => {
    const a = (await call('POST', '/api/organizations', { name: 'A' })).json().id;
    const b = (await call('POST', '/api/organizations', { name: 'B' })).json().id;
    const foreign = (await call('POST', `/api/organizations/${b}/agents`, profile('Zed'))).json().id;
    const project = (memberIds: string[]) =>
      call('POST', `/api/organizations/${a}/projects`, { name: 'P', workspacePath: '/tmp/x', memberIds });

    expect((await project([foreign])).statusCode).toBe(400);
    expect((await project(['nope'])).statusCode).toBe(404);
  });
});
