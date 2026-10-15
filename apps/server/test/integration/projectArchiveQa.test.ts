import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitForAbort } from '../support/FakeAgentRuntime.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

describe('project archiving QA edge cases', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;
  let projectId: string;
  let agentId: string;
  let mateId: string;

  beforeEach(async () => {
    fleet = createTestFleet({
      CTO: async (request) => {
        if (request.prompt.includes('delegate')) {
          const outcome = await request.delegation.delegate({
            collaboratorName: 'Backend',
            title: 'sub',
            instructions: 'go',
          });
          request.delegation.reportResult(outcome.summary);
          return 'delegated';
        }
        return request.prompt.includes('hold') ? waitForAbort(request.signal) : 'done';
      },
      Backend: (request) => (request.prompt.includes('hold') ? waitForAbort(request.signal) : 'sub done'),
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, members, project } = await createTeamProject(fleet, ['Backend']);
    projectId = project.id;
    agentId = cto.id;
    mateId = members[0]!.id;
  });

  afterEach(() => app.close());

  const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, payload });
  const archive = (id = projectId) => post(`/api/projects/${id}/archive`);
  const unarchive = (id = projectId) => post(`/api/projects/${id}/unarchive`);
  const createTask = (payload: Record<string, unknown> = {}) =>
    post(`/api/projects/${projectId}/tasks`, { agentId, title: 'T', description: 'D', ...payload });
  const status = async (id: string): Promise<string> =>
    (await app.inject({ method: 'GET', url: `/api/tasks/${id}` })).json().status;

  it('unarchive on an active project is a no-op returning 200', async () => {
    const response = await unarchive();

    expect(response.statusCode).toBe(200);
    expect(response.json().archivedAt).toBeNull();
  });

  it('re-archiving after unarchive stamps a fresh date', async () => {
    const first = (await archive()).json().archivedAt;
    await unarchive();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect((await archive()).json().archivedAt).not.toBe(first);
  });

  it('cancelling a task of an archived project still works', async () => {
    const task = (await createTask({ description: 'hold' })).json();
    await eventually(async () => expect(await status(task.id)).toBe('running'));
    await post(`/api/tasks/${task.id}/cancel`);
    await eventually(async () => expect(await status(task.id)).toBe('cancelled'));
    await archive();

    const again = await post(`/api/tasks/${task.id}/cancel`);

    expect(again.statusCode).not.toBe(409);
  });

  it('rejects queue reordering with 409 while archived', async () => {
    await archive();

    const response = await app.inject({
      method: 'PUT',
      url: `/api/projects/${projectId}/queue`,
      payload: { taskIds: [] },
    });

    expect(response.statusCode).toBe(409);
  });

  it('still lets a draft be dequeued/read and listed while archived', async () => {
    const draft = (await createTask({ start: 'draft' })).json();
    await archive();

    const list = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/tasks` });

    expect(list.statusCode).toBe(200);
    expect(list.json().map((t: { id: string }) => t.id)).toContain(draft.id);
  });

  it('deleting a member agent of an archived project succeeds and drops it from members', async () => {
    await archive();

    const response = await app.inject({ method: 'DELETE', url: `/api/agents/${mateId}` });

    expect(response.statusCode).toBe(204);
    const project = (await app.inject({ method: 'GET', url: `/api/projects/${projectId}` })).json();
    expect(project.memberIds).not.toContain(mateId);
    expect(project.archivedAt).not.toBeNull();
  });

  it('refuses to archive while a root task waits on a delegated subtask', async () => {
    const root = (await createTask({ description: 'delegate' })).json();

    // Whatever the root's state mid-flight, archiving must never succeed while it is active.
    const mid = await archive();
    const rootStatus = await status(root.id);
    if (['pending', 'running', 'waiting_subtasks'].includes(rootStatus)) expect(mid.statusCode).toBe(409);

    await eventually(async () => expect(await status(root.id)).toBe('completed'));
    expect((await archive()).statusCode).toBe(200);
  });

  it('archiving racing with a just-created task never leaves an archived project with a running task', async () => {
    const [created, archived] = await Promise.all([createTask({ description: 'hold' }), archive()]);

    const tasks = (await app.inject({ method: 'GET', url: `/api/projects/${projectId}/tasks` })).json();
    const live = tasks.filter((t: { status: string }) => ['pending', 'running'].includes(t.status));
    if (archived.statusCode === 200) {
      expect(created.statusCode).toBe(409);
      expect(live).toHaveLength(0);
    } else {
      expect(archived.statusCode).toBe(409);
    }
  });

  it('keeps organization isolation: archiving does not touch other organizations', async () => {
    const other = (await post('/api/organizations', { name: 'Other' })).json();
    const { project: foreign } = await createTeamProject(fleet, [], other.id);

    await archive();

    const foreignProject = (await app.inject({ method: 'GET', url: `/api/projects/${foreign.id}` })).json();
    expect(foreignProject.archivedAt).toBeNull();
    const foreignList = await app.inject({ method: 'GET', url: `/api/organizations/${other.id}/projects` });
    expect(foreignList.json().map((p: { id: string }) => p.id)).toEqual([foreign.id]);
  });

  it('cannot put a foreign-organization agent into an archived project (archive check first or validation, never 200)', async () => {
    const other = (await post('/api/organizations', { name: 'Other' })).json();
    const { cto: foreignAgent } = await createTeamProject(fleet, [], other.id);
    await archive();

    const response = await app.inject({
      method: 'PUT',
      url: `/api/projects/${projectId}/agents`,
      payload: { memberIds: [foreignAgent.id] },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('everything works again after unarchive: start, enqueue, members, reorder', async () => {
    const draft = (await createTask({ start: 'draft' })).json();
    await archive();
    await unarchive();

    const members = await app.inject({
      method: 'PUT',
      url: `/api/projects/${projectId}/agents`,
      payload: { memberIds: [agentId, mateId] },
    });
    const reorder = await app.inject({
      method: 'PUT',
      url: `/api/projects/${projectId}/queue`,
      payload: { taskIds: [] },
    });
    const start = await post(`/api/tasks/${draft.id}/start`);

    expect(members.statusCode).toBe(200);
    expect(reorder.statusCode).toBe(200);
    expect(start.statusCode).toBe(202);
  });
});
