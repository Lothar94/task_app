import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitForAbort } from '../support/FakeAgentRuntime.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

describe('project archiving API', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;
  let projectId: string;
  let agentId: string;

  beforeEach(async () => {
    fleet = createTestFleet({
      CTO: (request) => (request.prompt.includes('hold') ? waitForAbort(request.signal) : 'done'),
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, project } = await createTeamProject(fleet, []);
    projectId = project.id;
    agentId = cto.id;
  });

  afterEach(() => app.close());

  const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, payload });
  const archive = (id = projectId) => post(`/api/projects/${id}/archive`);
  const unarchive = (id = projectId) => post(`/api/projects/${id}/unarchive`);
  const taskStatus = async (id: string): Promise<string> =>
    (await app.inject({ method: 'GET', url: `/api/tasks/${id}` })).json().status;
  const createTask = (payload: Record<string, unknown> = {}) =>
    post(`/api/projects/${projectId}/tasks`, { agentId, title: 'T', description: 'D', ...payload });

  it('archives and unarchives, serialising archivedAt', async () => {
    const archived = await archive();

    expect(archived.statusCode).toBe(200);
    expect(new Date(archived.json().archivedAt).toISOString()).toBe(archived.json().archivedAt);

    const restored = await unarchive();
    expect(restored.statusCode).toBe(200);
    expect(restored.json().archivedAt).toBeNull();
  });

  it('is idempotent and keeps the original archive date', async () => {
    const first = (await archive()).json();
    const second = (await archive()).json();

    expect(second.archivedAt).toBe(first.archivedAt);
    expect((await unarchive()).statusCode).toBe(200);
    expect((await unarchive()).json().archivedAt).toBeNull();
  });

  it('answers 404 for unknown projects', async () => {
    expect((await archive('nope')).statusCode).toBe(404);
    expect((await unarchive('nope')).statusCode).toBe(404);
  });

  it('lists archived projects with archivedAt', async () => {
    await archive();

    const list = await app.inject({
      method: 'GET',
      url: `/api/organizations/${DEFAULT_ORGANIZATION_ID}/projects`,
    });

    expect(list.json()).toEqual([expect.objectContaining({ id: projectId, archivedAt: expect.any(String) })]);
  });

  it('refuses to archive while a task is running', async () => {
    await createTask({ description: 'hold' });

    const response = await archive();

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain('running or queued');
  });

  it('refuses to archive while a task is queued', async () => {
    await createTask({ description: 'hold' });
    await createTask({ start: 'queue' });

    expect((await archive()).statusCode).toBe(409);
  });

  it('archives once the running task is cancelled', async () => {
    const task = (await createTask({ description: 'hold' })).json();
    await eventually(async () => expect(await taskStatus(task.id)).toBe('running'));
    await post(`/api/tasks/${task.id}/cancel`);
    await eventually(async () => expect(await taskStatus(task.id)).toBe('cancelled'));

    await eventually(async () => expect((await archive()).statusCode).toBe(200));
  });

  describe('read-only while archived', () => {
    it('rejects new tasks, member changes, and draft starts with 409', async () => {
      const draft = (await createTask({ start: 'draft' })).json();
      await archive();

      expect((await createTask()).statusCode).toBe(409);
      const members = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}/agents`,
        payload: { memberIds: [] },
      });
      expect(members.statusCode).toBe(409);
      expect(members.json().error).toContain('is archived');
      expect((await post(`/api/tasks/${draft.id}/start`)).statusCode).toBe(409);
      expect((await post(`/api/tasks/${draft.id}/enqueue`)).statusCode).toBe(409);
      const edit = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${draft.id}`,
        payload: { title: 'X' },
      });
      expect(edit.statusCode).toBe(409);
    });

    it('rejects follow-ups but still allows reads', async () => {
      const task = (await createTask()).json();
      await eventually(async () => {
        const current = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` });
        expect(current.json().status).toBe('completed');
      });
      await archive();

      const followUp = await post(`/api/tasks/${task.id}/messages`, { message: 'more' });

      expect(followUp.statusCode).toBe(409);
      expect((await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: `/api/projects/${projectId}` })).statusCode).toBe(200);
    });

    it('accepts changes again after unarchiving', async () => {
      await archive();
      await unarchive();

      expect((await createTask()).statusCode).toBe(201);
    });
  });
});
