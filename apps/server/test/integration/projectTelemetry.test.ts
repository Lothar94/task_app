import type { ProjectsTelemetryDto, ResumeProjectResultDto, TaskDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

const REASONS: Record<string, string> = {
  'limit-a': 'Claude AI usage limit reached',
  'limit-b': 'context window exceeded',
  generic: 'TypeError: boom',
};

describe('project telemetry API', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;
  let projectId: string;
  let organizationId: string;
  let agentId: string;
  let failing: boolean;
  let release: () => void;
  let gate: Promise<string>;

  beforeEach(async () => {
    failing = true;
    gate = new Promise((resolve) => (release = () => resolve('done')));
    fleet = createTestFleet({
      CTO: (request) => {
        const title = Object.keys(REASONS).find((key) => request.prompt.includes(key));
        if (failing && title) throw new Error(REASONS[title]);
        return gate;
      },
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, project } = await createTeamProject(fleet, []);
    projectId = project.id;
    organizationId = project.organizationId;
    agentId = cto.id;
  });

  afterEach(async () => {
    release();
    await app.close();
  });

  const startTask = async (title: string) => {
    const task = fleet.useCases.assignTask.execute(projectId, {
      agentId,
      title,
      description: `do ${title}`,
      start: 'now',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('failed'));
    return task.id;
  };

  const telemetry = async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/organizations/${organizationId}/projects/telemetry`,
    });
    expect(response.statusCode).toBe(200);
    return response.json<ProjectsTelemetryDto>();
  };

  const resume = () => app.inject({ method: 'POST', url: `/api/projects/${projectId}/resume` });

  it('returns the telemetry shape with alerts for recoverable failures', async () => {
    const a = await startTask('limit-a');
    const b = await startTask('limit-b');
    await startTask('generic');

    const body = await telemetry();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      projectId,
      status: 'attention',
      counts: { total: 3, failed: 3, completed: 0 },
      successRate: 0,
      activeSubtask: null,
      alerts: [
        { kind: 'session_limit', taskIds: [a] },
        { kind: 'token_limit', taskIds: [b] },
      ],
    });
    expect(body.summary).toMatchObject({ activeProjects: 1, totalTasks: 3, swarmAgentIds: [agentId] });
    expect(new Date(body.generatedAt).getTime()).not.toBeNaN();
  });

  it('answers 404 for an unknown organization', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/organizations/nope/projects/telemetry' });
    expect(response.statusCode).toBe(404);
  });

  it('resume re-queues only recoverable failed root tasks and starts the first', async () => {
    const a = await startTask('limit-a');
    const b = await startTask('limit-b');
    const generic = await startTask('generic');
    failing = false;
    const updates: Array<[string, string]> = [];
    fleet.events.subscribe((event) => {
      if (event.type === 'task.updated') updates.push([event.task.id, event.task.status]);
    });

    const response = await resume();

    expect(response.statusCode).toBe(200);
    const { requeued } = response.json<ResumeProjectResultDto>();
    expect(requeued.map((task: TaskDto) => task.id)).toEqual([a, b]);
    expect(requeued.every((task) => task.resultSummary === null && task.finishedAt === null)).toBe(true);
    expect(updates).toContainEqual([a, 'queued']);
    expect(updates).toContainEqual([b, 'queued']);
    expect(fleet.useCases.getTask.execute(generic).status).toBe('failed');
    expect(fleet.useCases.getTask.execute(a).status).toBe('running');
    expect(fleet.useCases.getTask.execute(b).status).toBe('queued');
    expect((await telemetry()).projects[0]?.alerts).toEqual([]);
  });

  it('resume is a no-op when nothing is recoverable', async () => {
    await startTask('generic');
    const response = await resume();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ requeued: [] });
  });

  it('resume answers 409 for an archived project and 404 for an unknown one', async () => {
    fleet.useCases.archiveProject.execute(projectId);
    expect((await resume()).statusCode).toBe(409);
    const missing = await app.inject({ method: 'POST', url: '/api/projects/nope/resume' });
    expect(missing.statusCode).toBe(404);
  });
});
