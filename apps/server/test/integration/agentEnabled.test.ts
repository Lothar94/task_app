import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollaboratorInfo, DelegationGateway } from '../../src/application/ports/AgentRuntime.js';
import { ConflictError } from '../../src/domain/errors/DomainError.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

describe('enabling and disabling agents', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;
  /** What the CTO's next run does with its delegation gateway. */
  let ctoAction: (gateway: DelegationGateway) => Promise<unknown> | unknown;
  let ctoOutcome: { listed?: CollaboratorInfo[]; error?: unknown };

  beforeEach(async () => {
    ctoOutcome = {};
    ctoAction = () => undefined;
    fleet = createTestFleet({
      CTO: async (request) => {
        ctoOutcome.listed = request.delegation.listCollaborators();
        try {
          await ctoAction(request.delegation);
        } catch (error) {
          ctoOutcome.error = error;
        }
        return 'CTO done';
      },
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });
  afterEach(() => app.close());

  const setEnabled = (agentId: string, payload: object) =>
    app.inject({ method: 'PUT', url: `/api/agents/${agentId}/enabled`, payload });

  async function teamWithDisabledDev() {
    const team = await createTeamProject(fleet, ['Dev', 'QA']);
    const [dev] = team.members;
    expect((await setEnabled(dev!.id, { enabled: false })).statusCode).toBe(200);
    return { ...team, dev: dev! };
  }

  async function runCto(project: { id: string }, ctoId: string) {
    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: ctoId,
      title: 'Lead',
      description: 'Lead',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
  }

  it('disables and enables an agent through PUT /enabled', async () => {
    const { members } = await createTeamProject(fleet, ['Dev']);
    const id = members[0]!.id;

    const disabled = await setEnabled(id, { enabled: false });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json()).toMatchObject({ id, enabled: false });
    expect((await app.inject({ method: 'GET', url: `/api/agents/${id}` })).json()).toMatchObject({
      enabled: false,
    });

    expect((await setEnabled(id, { enabled: true })).json()).toMatchObject({ enabled: true });
  });

  it('answers 404 for an unknown agent and 400 for a malformed body', async () => {
    expect((await setEnabled('ghost', { enabled: false })).statusCode).toBe(404);
    const { members } = await createTeamProject(fleet, ['Dev']);
    expect((await setEnabled(members[0]!.id, { enabled: 'no' })).statusCode).toBe(400);
    expect((await setEnabled(members[0]!.id, {})).statusCode).toBe(400);
  });

  it('keeps the tasks already assigned to a disabled agent', async () => {
    const { project, members } = await createTeamProject(fleet, ['Dev']);
    const draft = fleet.useCases.assignTask.execute(project.id, {
      agentId: members[0]!.id,
      title: 'Later',
      description: 'D',
      start: 'draft',
    });

    await setEnabled(members[0]!.id, { enabled: false });

    expect(fleet.useCases.getTask.execute(draft.id)).toMatchObject({
      status: 'draft',
      agentId: members[0]!.id,
    });
    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${draft.id}`,
      payload: { agentId: members[0]!.id, title: 'Renamed' },
    });
    expect(edit.statusCode).toBe(200);
  });

  it('answers 409 when assigning a new task to a disabled agent', async () => {
    const { project, dev } = await teamWithDisabledDev();

    const response = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/tasks`,
      payload: { agentId: dev.id, title: 'T', description: 'D' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/disabled/);
  });

  it('answers 409 when reassigning a task to a disabled agent', async () => {
    const { project, cto, dev } = await teamWithDisabledDev();
    const draft = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'T',
      description: 'D',
      start: 'draft',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${draft.id}`,
      payload: { agentId: dev.id },
    });

    expect(response.statusCode).toBe(409);
    expect(fleet.useCases.getTask.execute(draft.id).agentId).toBe(cto.id);
  });

  it('leaves disabled agents out of the collaborators and rejects delegating to them', async () => {
    const { project, cto } = await teamWithDisabledDev();
    ctoAction = (gateway) =>
      gateway.delegate({ collaboratorName: 'Dev', title: 'Sub', instructions: 'Do it' });

    await runCto(project, cto.id);

    expect(ctoOutcome.listed?.map((collaborator) => collaborator.name)).toEqual(['QA']);
    expect(ctoOutcome.error).toBeInstanceOf(ConflictError);
    expect((ctoOutcome.error as Error).message).toMatch(/"Dev" is disabled/);
    expect(fleet.useCases.getTaskTree.execute(project.id).flatMap((node) => node.children)).toEqual([]);
  });

  it('rejects proposing a task for a disabled agent', async () => {
    const { project, cto } = await teamWithDisabledDev();
    ctoAction = (gateway) => gateway.proposeTask({ title: 'Idea', description: 'D', assigneeName: 'Dev' });

    await runCto(project, cto.id);

    expect(ctoOutcome.error).toBeInstanceOf(ConflictError);
    const tasks = (await app.inject({ method: 'GET', url: `/api/projects/${project.id}/tasks` })).json();
    expect(tasks).toHaveLength(1);
  });
});
