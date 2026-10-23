import type { TaskDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

describe('retry task API', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;
  let projectId: string;
  let agentId: string;
  let failing: boolean;
  let release: () => void;

  beforeEach(async () => {
    failing = true;
    const gate = new Promise<string>((resolve) => (release = () => resolve('held')));
    fleet = createTestFleet({
      CTO: async (request) => {
        if (request.prompt.includes('hold')) return gate;
        if (request.prompt.includes('delegate')) {
          await request.delegation.delegate({ collaboratorName: 'Backend', title: 'sub', instructions: 'go' });
          return 'delegated';
        }
        if (failing) throw new Error('API Error: 429 Too Many Requests');
        return 'done';
      },
      Backend: () => {
        throw new Error('boom');
      },
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, project } = await createTeamProject(fleet, ['Backend']);
    projectId = project.id;
    agentId = cto.id;
  });

  afterEach(async () => {
    release();
    await app.close();
  });

  const runTask = async (title: string, status: TaskDto['status']) => {
    const task = fleet.useCases.assignTask.execute(projectId, {
      agentId,
      title,
      description: title,
      start: 'now',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe(status));
    return task.id;
  };

  const retry = (taskId: string) => app.inject({ method: 'POST', url: `/api/tasks/${taskId}/retry` });

  it('re-queues a failed root task and runs it again', async () => {
    const taskId = await runTask('flaky', 'failed');
    failing = false;

    const response = await retry(taskId);

    expect(response.statusCode).toBe(200);
    expect(response.json<TaskDto>()).toMatchObject({ id: taskId, resultSummary: null, finishedAt: null });
    await eventually(() => expect(fleet.useCases.getTask.execute(taskId).status).toBe('completed'));
  });

  it('waits in the queue while another task of the project runs', async () => {
    const taskId = await runTask('flaky', 'failed');
    failing = false;
    const holding = await runTask('hold', 'running');

    expect(fleet.useCases.retryTask.execute(taskId).status).toBe('queued');
    release();

    await eventually(() => expect(fleet.useCases.getTask.execute(holding).status).toBe('completed'));
    await eventually(() => expect(fleet.useCases.getTask.execute(taskId).status).toBe('completed'));
  });

  it('answers 409 for a task that did not fail and for a failed subtask', async () => {
    failing = false;
    const completed = await runTask('fine', 'completed');
    expect((await retry(completed)).statusCode).toBe(409);

    const root = await runTask('delegate', 'completed');
    const [tree] = fleet.useCases.getTaskTree.execute(projectId).filter((node) => node.id === root);
    const subtask = tree?.children[0];
    expect(subtask?.status).toBe('failed');
    expect((await retry(subtask?.id ?? '')).statusCode).toBe(409);
  });

  it('answers 404 for an unknown task and 409 for an archived project', async () => {
    expect((await retry('nope')).statusCode).toBe(404);
    const taskId = await runTask('flaky', 'failed');
    fleet.useCases.archiveProject.execute(projectId);
    expect((await retry(taskId)).statusCode).toBe(409);
    expect(fleet.useCases.getTask.execute(taskId).status).toBe('failed');
  });
});
