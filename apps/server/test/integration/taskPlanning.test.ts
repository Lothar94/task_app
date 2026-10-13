import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { waitForAbort } from '../support/FakeAgentRuntime.js';
import { ConflictError } from '../../src/domain/errors/DomainError.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

type Fleet = ReturnType<typeof createTestFleet>;

describe('task planning API', () => {
  let app: FastifyInstance;
  let fleet: Fleet;
  let projectId: string;
  let agentId: string;
  let release: () => void;
  let gate: Promise<string>;

  beforeEach(async () => {
    gate = new Promise((resolve) => (release = () => resolve('done')));
    fleet = createTestFleet({
      CTO: (request) => (request.prompt.includes('cancelme') ? waitForAbort(request.signal) : gate),
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, project } = await createTeamProject(fleet, []);
    projectId = project.id;
    agentId = cto.id;
  });

  afterEach(() => app.close());

  const create = (payload: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tasks`,
      payload: { agentId, title: 'T', description: 'D', ...payload },
    });
  const post = (url: string) => app.inject({ method: 'POST', url });
  const get = async (id: string) => (await app.inject({ method: 'GET', url: `/api/tasks/${id}` })).json();
  const createId = async (payload: Record<string, unknown> = {}) =>
    (await create(payload)).json().id as string;
  const statuses = (ids: string[]) => Promise.all(ids.map(async (id) => (await get(id)).status));
  // Agents finish only once `release()` is called.

  it('creates drafts without running the agent', async () => {
    const response = await create({ start: 'draft', milestone: ' M1 ', tags: ['a', 'A', ' b '] });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: 'draft',
      milestone: 'M1',
      tags: ['a', 'b'],
      queuePosition: null,
    });
    expect(fleet.runtime.requests).toHaveLength(0);
  });

  it('still runs tasks immediately by default', async () => {
    const response = await create();
    expect(response.json()).toMatchObject({ milestone: null, tags: [] });
    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));
  });

  it('rejects invalid tags and start modes', async () => {
    expect((await create({ tags: ['x'.repeat(41)] })).statusCode).toBe(400);
    expect((await create({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })).statusCode).toBe(400);
    expect((await create({ start: 'later' })).statusCode).toBe(400);
  });

  it('starts a draft on demand and rejects starting it twice', async () => {
    const id = await createId({ start: 'draft' });

    const started = await post(`/api/tasks/${id}/start`);

    expect(started.statusCode).toBe(202);
    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));
    expect((await post(`/api/tasks/${id}/start`)).statusCode).toBe(409);
  });

  describe('queue', () => {
    it('runs queued tasks one at a time in queue order', async () => {
      const ids: string[] = [];
      for (const title of ['one', 'two', 'three']) ids.push(await createId({ start: 'queue', title }));

      await eventually(async () => expect(await get(ids[0] as string)).toMatchObject({ status: 'running' }));
      expect(await statuses(ids)).toEqual(['running', 'queued', 'queued']);
      expect((await get(ids[1] as string)).queuePosition).toBe(1);
      expect((await get(ids[2] as string)).queuePosition).toBe(2);
      expect(fleet.runtime.requests).toHaveLength(1);

      release();
      await eventually(() => expect(fleet.runtime.requests).toHaveLength(3));
      await eventually(async () =>
        expect(await statuses(ids)).toEqual(['completed', 'completed', 'completed']),
      );
      ['one', 'two', 'three'].forEach((title, index) =>
        expect(fleet.runtime.requests[index]?.prompt).toContain(title),
      );
    });

    it('reorders the queue and runs in the new order', async () => {
      const first = await createId({ start: 'queue', title: 'first' });
      const a = await createId({ start: 'queue', title: 'second' });
      const b = await createId({ start: 'queue', title: 'third' });
      await eventually(async () => expect((await get(first)).status).toBe('running'));

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}/queue`,
        payload: { taskIds: [b, a] },
      });

      expect(response.statusCode).toBe(200);
      expect(
        response.json().map((task: { id: string; queuePosition: number }) => [task.id, task.queuePosition]),
      ).toEqual([
        [b, 1],
        [a, 2],
      ]);
      release();
      await eventually(() => expect(fleet.runtime.requests).toHaveLength(3));
      expect(fleet.runtime.requests[1]?.prompt).toContain('third');
      expect(fleet.runtime.requests[2]?.prompt).toContain('second');
    });

    it('rejects a reorder that is not exactly the queued set', async () => {
      await createId({ start: 'queue' });
      const a = await createId({ start: 'queue' });
      const b = await createId({ start: 'queue' });
      const reorder = (taskIds: string[]) =>
        app.inject({ method: 'PUT', url: `/api/projects/${projectId}/queue`, payload: { taskIds } });

      expect((await reorder([a])).statusCode).toBe(400);
      expect((await reorder([a, a])).statusCode).toBe(400);
      expect((await reorder([a, b, 'nope'])).statusCode).toBe(400);
    });

    it('returns a dequeued task to draft and renumbers the queue', async () => {
      await createId({ start: 'queue' });
      const a = await createId({ start: 'queue' });
      const b = await createId({ start: 'queue' });

      const dequeued = await post(`/api/tasks/${a}/dequeue`);

      expect(dequeued.json()).toMatchObject({ status: 'draft', queuePosition: null });
      expect((await get(b)).queuePosition).toBe(1);
      const again = await post(`/api/tasks/${a}/dequeue`);
      expect(again.statusCode).toBe(409);
      expect(again.json().error).toBe(`Task "${a}" is not queued`);
      const enqueued = await post(`/api/tasks/${a}/enqueue`);
      expect(enqueued.json()).toMatchObject({ status: 'queued', queuePosition: 2 });
    });

    it('cancels draft and queued tasks and renumbers the queue', async () => {
      await createId({ start: 'queue' });
      const queuedA = await createId({ start: 'queue' });
      const queuedB = await createId({ start: 'queue' });
      const draft = await createId({ start: 'draft' });

      await post(`/api/tasks/${queuedA}/cancel`);
      await post(`/api/tasks/${draft}/cancel`);

      expect((await get(queuedA)).status).toBe('cancelled');
      expect((await get(draft)).status).toBe('cancelled');
      expect(await get(queuedB)).toMatchObject({ status: 'queued', queuePosition: 1 });
    });

    it('starts a queued task on demand and renumbers the rest', async () => {
      await createId({ start: 'queue' });
      const a = await createId({ start: 'queue' });
      const b = await createId({ start: 'queue' });

      const started = await post(`/api/tasks/${a}/start`);

      expect(started.statusCode).toBe(202);
      expect((await get(b)).queuePosition).toBe(1);
      await eventually(() => expect(fleet.runtime.requests).toHaveLength(2));
    });

    it('moves on to the next task when the previous one is cancelled', async () => {
      const first = await createId({ start: 'queue', title: 'cancelme' });
      const second = await createId({ start: 'queue', title: 'second' });
      await eventually(async () => expect((await get(first)).status).toBe('running'));

      release();
      await post(`/api/tasks/${first}/cancel`);

      await eventually(async () => expect((await get(second)).status).toBe('completed'));
      expect((await get(first)).status).toBe('cancelled');
    });
  });

  describe('updates', () => {
    const patch = (id: string, payload: Record<string, unknown>) =>
      app.inject({ method: 'PATCH', url: `/api/tasks/${id}`, payload });

    it('edits a draft', async () => {
      const id = await createId({ start: 'draft' });
      const response = await patch(id, { title: 'New', milestone: 'M2', tags: ['x'] });
      expect(response.json()).toMatchObject({ title: 'New', milestone: 'M2', tags: ['x'], status: 'draft' });
    });

    it('rejects editing the title of a running task but allows retagging it', async () => {
      const id = await createId();
      await eventually(async () => expect((await get(id)).status).toBe('running'));

      expect((await patch(id, { title: 'Late' })).statusCode).toBe(409);
      expect((await patch(id, { milestone: 'M3', tags: ['late'] })).statusCode).toBe(200);
      release();
    });

    it('retags a completed task', async () => {
      release();
      const id = await createId();
      await eventually(async () => expect((await get(id)).status).toBe('completed'));

      const response = await patch(id, { milestone: 'Done', tags: ['t'] });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ milestone: 'Done', tags: ['t'] });
    });

    it('requires the new agent to be a project member', async () => {
      const outsider = await fleet.useCases.createAgent.execute({
        profile: {
          name: 'Out',
          role: 'r',
          description: '',
          instructions: 'i',
          model: 'sonnet',
          effort: 'high',
          allowedTools: [],
          permissionMode: 'dontAsk',
          maxTurns: 5,
        },
        collaboratorIds: [],
      });
      const id = await createId({ start: 'draft' });

      expect((await patch(id, { agentId: outsider.id })).statusCode).toBe(400);
    });

    it('rejects invalid tags', async () => {
      const id = await createId({ start: 'draft' });
      expect((await patch(id, { tags: ['x'.repeat(41)] })).statusCode).toBe(400);
    });
  });

  it('does not let planning endpoints touch subtasks', async () => {
    const subFleet = createTestFleet({
      CTO: (request) =>
        request.delegation
          .delegate({ collaboratorName: 'Backend', title: 'sub', instructions: 'i' })
          .then(() => 'ok'),
      Backend: () => gate,
    });
    const { cto, project } = await createTeamProject(subFleet, ['Backend']);
    subFleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'root', description: 'd' });
    await eventually(() =>
      expect(subFleet.useCases.getTaskTree.execute(project.id)[0]?.children).toHaveLength(1),
    );
    const childId = subFleet.useCases.getTaskTree.execute(project.id)[0]?.children[0]?.id as string;

    expect(() => subFleet.useCases.enqueueTask.execute(childId)).toThrow(ConflictError);
    expect(() => subFleet.useCases.startTask.execute(childId)).toThrow(ConflictError);
    expect(() => subFleet.useCases.updateTask.execute(childId, { tags: ['x'] })).toThrow(ConflictError);
    release();
  });
});

describe('restart recovery', () => {
  it('fails only interrupted tasks, keeps drafts and queued tasks, and restarts the queue', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<string>((resolve) => (release = () => resolve('done')));
    const fleet = createTestFleet({ CTO: (request) => (request.prompt.includes('busy') ? gate : 'ok') });
    const { cto, project } = await createTeamProject(fleet, []);
    const input = { agentId: cto.id, description: 'D' };
    const assign = (title: string, start: 'now' | 'draft' | 'queue') =>
      fleet.useCases.assignTask.execute(project.id, { ...input, title, start });
    const busy = assign('busy', 'now');
    const draft = assign('draft', 'draft');
    const queued = assign('queued', 'queue');
    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));

    expect(fleet.recoverInterruptedTasks.execute()).toBe(1);

    const status = (id: string) => fleet.useCases.getTask.execute(id).status;
    expect([status(busy.id), status(draft.id), status(queued.id)]).toEqual(['failed', 'draft', 'queued']);
    fleet.processTaskQueues();
    await eventually(() => expect(status(queued.id)).toBe('completed'));
    expect(status(draft.id)).toBe('draft');
    release();
  });
});
