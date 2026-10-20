import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const WORKSPACE = '/tmp/fleet-test-workspace';

describe('task telemetry', () => {
  let app: FastifyInstance | undefined;
  afterEach(() => app?.close());

  async function runCto(fleet: ReturnType<typeof createTestFleet>) {
    const { cto, project } = await createTeamProject(fleet, []);
    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Work',
      description: 'Do it',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    return task;
  }

  const get = (url: string) => app!.inject({ method: 'GET', url });

  it('records llm and tool time of a run and serves it through the execution endpoint', async () => {
    const fleet = createTestFleet();
    fleet.runtime.toolDelaysMs['CTO'] = 40;
    const task = await runCto(fleet);

    const response = await get(`/api/tasks/${task.id}/execution`);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.taskId).toBe(task.id);
    expect(body.runs).toHaveLength(1);
    expect(body.primaryModel).toBe('claude-sonnet');
    expect(body.time.llmMs).toBe(1200);
    expect(body.time.toolMs).toBeGreaterThanOrEqual(35);
    expect(body.own.runs).toBe(1);
  });

  it('answers 404 for unknown tasks on every telemetry endpoint', async () => {
    await runCto(createTestFleet());

    for (const suffix of ['execution', 'git', 'git/diff']) {
      expect((await get(`/api/tasks/nope/${suffix}`)).statusCode).toBe(404);
    }
  });

  it('snapshots the workspace HEAD around the run and serves the git context and diff', async () => {
    const fleet = createTestFleet();
    fleet.git.heads.set(WORKSPACE, { sha: BASE, branch: 'main' });
    fleet.runtime.toolDelaysMs['CTO'] = 1;
    fleet.git.files = [{ path: 'src/a.ts', additions: 2, deletions: 1 }];
    fleet.git.patch = 'diff --git a/src/a.ts b/src/a.ts';
    const originalHead = fleet.git.head.bind(fleet.git);
    let calls = 0;
    fleet.git.head = async (path) => {
      if (calls++ >= 1) fleet.git.heads.set(WORKSPACE, { sha: HEAD, branch: 'main' });
      return originalHead(path);
    };
    const task = await runCto(fleet);

    const context = (await get(`/api/tasks/${task.id}/git`)).json();
    const diff = await get(`/api/tasks/${task.id}/git/diff`);

    expect(context).toMatchObject({
      status: 'ok',
      live: false,
      base: { sha: BASE, branch: 'main' },
      head: { sha: HEAD, branch: 'main' },
      files: [{ path: 'src/a.ts', additions: 2, deletions: 1 }],
    });
    expect(diff.statusCode).toBe(200);
    expect(diff.json()).toEqual({
      taskId: task.id,
      baseSha: BASE,
      headSha: HEAD,
      patch: 'diff --git a/src/a.ts b/src/a.ts',
      truncated: false,
    });
  });

  it('reports not_a_repository, and 409 on the diff, when the workspace has no git', async () => {
    const task = await runCto(createTestFleet());

    expect((await get(`/api/tasks/${task.id}/git`)).json()).toEqual({
      status: 'not_a_repository',
      taskId: task.id,
    });
    const diff = await get(`/api/tasks/${task.id}/git/diff`);
    expect(diff.statusCode).toBe(409);
    expect(diff.json()).toMatchObject({ error: expect.any(String) });
  });

  it('still completes the run when git fails', async () => {
    const fleet = createTestFleet();
    fleet.git.failWith = new Error('git exploded');

    const task = await runCto(fleet);

    expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed');
    expect((await get(`/api/tasks/${task.id}/execution`)).json().runs).toHaveLength(1);
  });
});
