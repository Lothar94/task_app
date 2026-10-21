import type { AgentDto, AgentExportDto } from '@fleet/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AgentRunRequest } from '../../src/application/ports/AgentRuntime.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID as ORG } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createFleetToolServer } from '../../src/infrastructure/runtime/claude/FleetToolServer.js';
import { createTeamProject, createTestFleet, eventually, profile } from '../support/testFleet.js';

type Fleet = ReturnType<typeof createTestFleet>;

const delegate = (request: AgentRunRequest, extra: { model?: 'haiku' | 'opus'; effort?: 'low' | 'xhigh' }) =>
  request.delegation.delegate({ collaboratorName: 'Backend', title: 'Work', instructions: 'Do it', ...extra });

/** CTO delegates once to Backend, which is created with the given selection mode. */
async function delegationSetup(
  modelSelection: 'fixed' | 'auto',
  extra: Parameters<typeof delegate>[1],
  outcomes: unknown[] = [],
) {
  const fleet = createTestFleet({
    CTO: async (request) => {
      outcomes.push(await delegate(request, extra));
      return 'done';
    },
  });
  const backend = await fleet.useCases.createAgent.execute({
    organizationId: ORG,
    profile: profile('Backend', { model: 'sonnet', effort: 'medium', modelSelection }),
    collaboratorIds: [],
  });
  const cto = await fleet.useCases.createAgent.execute({
    organizationId: ORG,
    profile: profile('CTO'),
    collaboratorIds: [backend.id],
  });
  const project = fleet.useCases.createProject.execute({
    organizationId: ORG,
    details: { name: 'Demo', description: '', workspacePath: '/tmp/fleet-test-workspace' },
    memberIds: [cto.id, backend.id],
  });
  const root = fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });
  await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
  return { fleet, project };
}

const backendRequests = (fleet: Fleet) =>
  fleet.runtime.requests.filter((request) => request.systemPromptAppendix.includes('You are "Backend"'));

describe('delegation with automatic model selection', () => {
  it('runs an auto collaborator with the delegator choice and reports it', async () => {
    const outcomes: unknown[] = [];
    const { fleet, project } = await delegationSetup('auto', { model: 'opus', effort: 'xhigh' }, outcomes);

    expect(backendRequests(fleet)[0]).toMatchObject({ model: 'opus', effort: 'xhigh' });
    expect(outcomes[0]).toMatchObject({ model: 'opus', effort: 'xhigh' });
    const [tree] = fleet.useCases.getTaskTree.execute(project.id);
    expect(tree?.children[0]?.modelChoice).toEqual({ model: 'opus', effort: 'xhigh' });
  });

  it('uses the agent defaults when the delegator chooses nothing', async () => {
    const { fleet } = await delegationSetup('auto', {});

    expect(backendRequests(fleet)[0]).toMatchObject({ model: 'sonnet', effort: 'medium' });
  });

  it('mixes a partial choice with the agent defaults', async () => {
    const { fleet } = await delegationSetup('auto', { effort: 'low' });

    expect(backendRequests(fleet)[0]).toMatchObject({ model: 'sonnet', effort: 'low' });
  });

  it('ignores the choice for fixed collaborators and stores none', async () => {
    const outcomes: unknown[] = [];
    const { fleet, project } = await delegationSetup('fixed', { model: 'haiku', effort: 'low' }, outcomes);

    expect(backendRequests(fleet)[0]).toMatchObject({ model: 'sonnet', effort: 'medium' });
    expect(outcomes[0]).toMatchObject({ model: 'sonnet', effort: 'medium' });
    const [tree] = fleet.useCases.getTaskTree.execute(project.id);
    expect(tree?.children[0]?.modelChoice).toEqual({ model: null, effort: null });
  });

  it('reuses the stored choice in a follow-up on the subtask', async () => {
    const { fleet, project } = await delegationSetup('auto', { model: 'haiku', effort: 'low' });
    const [tree] = fleet.useCases.getTaskTree.execute(project.id);
    const subtaskId = tree?.children[0]?.id ?? '';

    fleet.useCases.sendFollowUp.execute(subtaskId, 'More');

    await eventually(() => expect(backendRequests(fleet)).toHaveLength(2));
    expect(backendRequests(fleet)[1]).toMatchObject({ model: 'haiku', effort: 'low' });
  });

  it('tells the delegator which collaborators choose their model', async () => {
    const { fleet } = await delegationSetup('auto', {});

    const cto = fleet.runtime.requests[0];
    expect(cto?.delegation.listCollaborators()).toEqual([expect.objectContaining({ modelSelection: 'auto' })]);
    expect(cto?.systemPromptAppendix).toContain('[auto model: you choose model and effort]');
  });
});

describe('delegate_task tool', () => {
  it('describes model and effort as optional, auto-only parameters', () => {
    const server = createFleetToolServer({} as never) as unknown as {
      instance: { _registeredTools: Record<string, { description: string; inputSchema: unknown }> };
    };
    const tool = server.instance._registeredTools.delegate_task as unknown as {
      inputSchema: { shape: Record<string, { description?: string }> };
    };
    const { model, effort } = tool.inputSchema.shape;
    const shape = `${model?.description} ${effort?.description}`;

    expect(shape).toContain('automatic model selection');
    expect(shape).toContain('Ignored for fixed collaborators');
  });
});

describe('model selection over HTTP', () => {
  let app: FastifyInstance;

  const start = async (fleet: Fleet) => {
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    return app;
  };

  afterEach(() => app.close());

  it('defaults to fixed, creates and updates auto agents, and rejects invalid modes', async () => {
    await start(createTestFleet());
    const post = (payload: object) =>
      app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents`, payload });
    const { modelSelection: _omit, ...legacy } = profile('Old');

    const old = (await post({ ...legacy, collaboratorIds: [] })).json<AgentDto>();
    const auto = (await post({ ...profile('New'), modelSelection: 'auto', collaboratorIds: [] })).json<AgentDto>();
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/agents/${old.id}`,
      payload: { ...legacy, modelSelection: 'auto' },
    });
    const invalid = await post({ ...profile('Bad'), modelSelection: 'random', collaboratorIds: [] });

    expect(old.modelSelection).toBe('fixed');
    expect(auto.modelSelection).toBe('auto');
    expect(updated.json<AgentDto>().modelSelection).toBe('auto');
    expect(invalid.statusCode).toBe(400);
  });

  it('stores the PM choice when assigning to an auto agent and ignores it for fixed ones', async () => {
    const fleet = createTestFleet();
    await start(fleet);
    const { members, project } = await createTeamProject(fleet, ['Auto', 'Fixed']);
    const [autoAgent, fixedAgent] = members;
    await app.inject({
      method: 'PUT',
      url: `/api/agents/${autoAgent?.id}`,
      payload: { ...profile('Auto'), modelSelection: 'auto' },
    });
    const assign = async (agentId: string | undefined, extra: object) =>
      (
        await app.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/tasks`,
          payload: { agentId, title: 'T', description: 'D', start: 'draft', ...extra },
        })
      ).json();

    const chosen = await assign(autoAgent?.id, { model: 'opus', effort: 'high' });
    const partial = await assign(autoAgent?.id, { effort: 'low' });
    const fixed = await assign(fixedAgent?.id, { model: 'opus', effort: 'high' });
    const invalid = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/tasks`,
      payload: { agentId: autoAgent?.id, title: 'T', description: 'D', model: 'gpt' },
    });

    expect(chosen.modelChoice).toEqual({ model: 'opus', effort: 'high' });
    expect(partial.modelChoice).toEqual({ model: null, effort: 'low' });
    expect(fixed.modelChoice).toEqual({ model: null, effort: null });
    expect(invalid.statusCode).toBe(400);
  });

  it('runs an auto task with the PM choice', async () => {
    const fleet = createTestFleet();
    await start(fleet);
    const { members, project } = await createTeamProject(fleet, ['Auto']);
    const agent = members[0];
    await app.inject({
      method: 'PUT',
      url: `/api/agents/${agent?.id}`,
      payload: { ...profile('Auto'), modelSelection: 'auto' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/tasks`,
      payload: { agentId: agent?.id, title: 'T', description: 'D', model: 'haiku', effort: 'low' },
    });

    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));
    expect(fleet.runtime.requests[0]).toMatchObject({ model: 'haiku', effort: 'low' });
  });

  it('round-trips the mode through export/import and reads old files as fixed', async () => {
    const fleet = createTestFleet();
    await start(fleet);
    await fleet.useCases.createAgent.execute({
      organizationId: ORG,
      profile: profile('Auto', { modelSelection: 'auto' }),
      collaboratorIds: [],
    });
    const file = (
      await app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents/export`, payload: {} })
    ).json<AgentExportDto>();
    const other = (await app.inject({ method: 'POST', url: '/api/organizations', payload: { name: 'Other' } })).json();
    const { modelSelection: _omit, ...legacy } = file.agents[0] ?? ({} as never);

    await app.inject({ method: 'POST', url: `/api/organizations/${other.id}/agents/import`, payload: { file } });
    const third = (await app.inject({ method: 'POST', url: '/api/organizations', payload: { name: 'Third' } })).json();
    await app.inject({
      method: 'POST',
      url: `/api/organizations/${third.id}/agents/import`,
      payload: { file: { ...file, agents: [legacy] } },
    });

    const modeIn = async (id: string) =>
      (await app.inject({ method: 'GET', url: `/api/organizations/${id}/agents` })).json<AgentDto[]>()[0]
        ?.modelSelection;
    expect(file.agents[0]?.modelSelection).toBe('auto');
    expect(await modeIn(other.id)).toBe('auto');
    expect(await modeIn(third.id)).toBe('fixed');
  });
});
