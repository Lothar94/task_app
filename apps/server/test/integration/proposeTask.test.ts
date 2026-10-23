import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProposedTaskInfo, TaskProposal } from '../../src/application/ports/AgentRuntime.js';
import { ConflictError, ValidationError } from '../../src/domain/errors/DomainError.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { FLEET_TOOL_NAMES } from '../../src/infrastructure/runtime/claude/FleetToolServer.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTeamProject, createTestFleet, eventually, profile } from '../support/testFleet.js';

type Fleet = ReturnType<typeof createTestFleet>;

describe('agent-proposed tasks', () => {
  let fleet: Fleet;
  let app: FastifyInstance;
  let projectId: string;
  let ctoId: string;
  let devId: string;
  let proposal: TaskProposal | null;
  let proposed: ProposedTaskInfo | null;
  let failure: unknown;

  beforeEach(async () => {
    proposed = null;
    failure = null;
    fleet = createTestFleet({
      CTO: (request) => {
        try {
          if (proposal) proposed = request.delegation.proposeTask(proposal);
        } catch (error) {
          failure = error;
        }
        return 'analysis done';
      },
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const { cto, members, project } = await createTeamProject(fleet, ['Dev']);
    projectId = project.id;
    ctoId = cto.id;
    devId = members[0]!.id;
  });

  afterEach(() => app.close());

  const runCto = async () => {
    const task = fleet.useCases.assignTask.execute(projectId, {
      agentId: ctoId,
      title: 'Analyse',
      description: 'Analyse the code',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).isFinished).toBe(true));
    return task;
  };
  const draftOf = (taskNumber: number) =>
    fleet.useCases.getTaskTree.execute(projectId).find((node) => node.number === taskNumber)!;

  it('creates a top-level draft for the proposer by default and never runs it', async () => {
    proposal = { title: 'Fix bug', description: 'Details', milestone: 'M1', tags: ['bug'] };
    await runCto();

    expect(proposed).toMatchObject({ taskNumber: 2, assigneeName: 'CTO' });
    expect(draftOf(2)).toMatchObject({
      status: 'draft',
      parentTaskId: null,
      agentId: ctoId,
      proposedByAgentId: ctoId,
      milestone: 'M1',
      tags: ['bug'],
    });
    expect(fleet.runtime.requests).toHaveLength(1);
  });

  it('assigns the draft to a named project member', async () => {
    proposal = { title: 'Fix bug', description: 'Details', assigneeName: ' Dev ' };
    await runCto();

    expect(proposed?.assigneeName).toBe('Dev');
    expect(draftOf(2)).toMatchObject({ agentId: devId, proposedByAgentId: ctoId, status: 'draft' });
  });

  it('rejects unknown agents and agents outside the project', async () => {
    await fleet.useCases.createAgent.execute({
      organizationId: DEFAULT_ORGANIZATION_ID,
      profile: profile('Outsider'),
      collaboratorIds: [],
    });
    for (const assigneeName of ['Nobody', 'Outsider']) {
      proposal = { title: 'T', description: 'D', assigneeName };
      await runCto();
      expect(failure).toBeInstanceOf(ValidationError);
      expect((failure as Error).message).toBe(`"${assigneeName}" is not a member of this project`);
    }
    expect(fleet.useCases.getTaskTree.execute(projectId)).toHaveLength(2);
  });

  it('rejects proposals once the project is archived', async () => {
    proposal = null;
    await runCto();
    fleet.useCases.archiveProject.execute(projectId);

    expect(() => fleet.runtime.requests[0]!.delegation.proposeTask({ title: 'T', description: 'D' })).toThrow(
      ConflictError,
    );
    expect(fleet.useCases.getTaskTree.execute(projectId)).toHaveLength(1);
  });

  it('lets the project manager start or queue the draft with the existing use cases', async () => {
    proposal = { title: 'Fix bug', description: 'Details' };
    await runCto();
    const draftId = draftOf(2).id;

    fleet.useCases.startTask.execute(draftId);

    await eventually(() => expect(fleet.runtime.requests).toHaveLength(2));
    expect(() => fleet.useCases.startTask.execute(draftId)).toThrow(ConflictError);
  });

  it('exposes proposedByAgentId over HTTP, null for manager tasks', async () => {
    proposal = { title: 'Fix bug', description: 'Details' };
    const manual = await runCto();
    const proposedId = draftOf(2).id;

    const get = async (id: string) => (await app.inject({ method: 'GET', url: `/api/tasks/${id}` })).json();
    expect((await get(manual.id)).proposedByAgentId).toBeNull();
    expect((await get(proposedId)).proposedByAgentId).toBe(ctoId);
  });

  it('registers create_task as a fleet tool', () => {
    expect(FLEET_TOOL_NAMES).toContain('mcp__fleet__create_task');
  });
});
