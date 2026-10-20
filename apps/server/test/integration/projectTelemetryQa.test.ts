import type { ProjectsTelemetryDto, ResumeProjectResultDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyFailure } from '../../src/application/projects/classifyFailure.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

describe('classifyFailure QA', () => {
  it('rate limit wins over token wording', () => {
    expect(classifyFailure('rate limit: context window')).toBe('session_limit');
  });
  it('does not flag unrelated failures', () => {
    expect(classifyFailure('TypeError: x is undefined')).toBeNull();
    expect(classifyFailure(null)).toBeNull();
  });
  it('does not flag a generic "budget" mention as token limit', () => {
    expect(classifyFailure('Cannot parse budget.csv')).toBeNull();
  });
});

describe('project telemetry QA', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;
  let projectId: string;
  let organizationId: string;
  let agentId: string;
  let release: () => void;
  let gate: Promise<string>;

  beforeEach(async () => {
    gate = new Promise((resolve) => (release = () => resolve('done')));
    fleet = createTestFleet({
      CTO: (request) => {
        if (request.prompt.includes('limit-')) throw new Error('usage limit reached');
        if (request.prompt.includes('generic')) throw new Error('boom');
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

  const start = async (title: string, wait: 'failed' | 'running') => {
    const task = fleet.useCases.assignTask.execute(projectId, {
      agentId,
      title,
      description: `do ${title}`,
      start: 'now',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe(wait));
    return task.id;
  };
  const get = async () =>
    (
      await app.inject({ method: 'GET', url: `/api/organizations/${organizationId}/projects/telemetry` })
    ).json<ProjectsTelemetryDto>();

  it('404 for unknown organization', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/organizations/nope/projects/telemetry' });
    expect(res.statusCode).toBe(404);
  });

  it('resume 404 for unknown project', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/projects/nope/resume' });
    expect(res.statusCode).toBe(404);
  });

  it('resume with nothing recoverable returns [] and leaves generic failure', async () => {
    const g = await start('generic', 'failed');
    const res = await app.inject({ method: 'POST', url: `/api/projects/${projectId}/resume` });
    expect(res.statusCode).toBe(200);
    expect(res.json<ResumeProjectResultDto>().requeued).toEqual([]);
    expect(fleet.useCases.getTask.execute(g).status).toBe('failed');
  });

  it('resume while another root runs keeps requeued task queued; second call is []', async () => {
    const failed = await start('limit-a', 'failed');
    const running = await start('long', 'running');
    const first = await app.inject({ method: 'POST', url: `/api/projects/${projectId}/resume` });
    expect(first.json<ResumeProjectResultDto>().requeued.map((t) => t.id)).toEqual([failed]);
    expect(fleet.useCases.getTask.execute(failed).status).toBe('queued');
    expect(fleet.useCases.getTask.execute(running).status).toBe('running');
    const second = await app.inject({ method: 'POST', url: `/api/projects/${projectId}/resume` });
    expect(second.json<ResumeProjectResultDto>().requeued).toEqual([]);
  });

  it('running project with active subtask reports it and status running', async () => {
    const id = await start('long', 'running');
    const body = await get();
    expect(body.projects[0]?.status).toBe('running');
    expect(body.projects[0]?.activeSubtask?.taskId).toBe(id);
  });
});
