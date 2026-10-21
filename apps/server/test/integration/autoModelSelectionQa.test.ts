import type { AgentExportDto, TaskDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentRunRequest, DelegationRequest } from '../../src/application/ports/AgentRuntime.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { waitForAbort } from '../support/FakeAgentRuntime.js';
import { createTestFleet, eventually, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;
type Choice = { model?: unknown; effort?: unknown };

describe('automatic model selection (QA)', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;
  let behaviours: Record<string, (request: AgentRunRequest) => Promise<string> | string>;
  let delegations: Record<string, Choice>;

  beforeEach(async () => {
    delegations = {};
    behaviours = {
      CTO: async (request) => {
        for (const [name, choice] of Object.entries(delegations)) {
          await request.delegation.delegate({
            collaboratorName: name,
            title: `${name} work`,
            instructions: 'Do it',
            ...choice,
          } as DelegationRequest);
        }
        return 'ok';
      },
    };
    fleet = createTestFleet(new Proxy({}, { get: (_t, name: string) => behaviours[name] }) as typeof behaviours);
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });

  afterEach(() => app.close());

  const createAgent = async (name: string, extra: Record<string, unknown> = {}, collaboratorIds: string[] = []) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/organizations/${ORG}/agents`,
      payload: { ...profile(name), collaboratorIds, ...extra },
    });
    return res;
  };
  const idOf = async (name: string, extra: Record<string, unknown> = {}, collaboratorIds: string[] = []) => {
    const res = await createAgent(name, extra, collaboratorIds);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  };

  /** Team of a CTO and one collaborator per [name, modelSelection] pair, in a project. */
  const team = async (members: [string, 'fixed' | 'auto' | undefined][]) => {
    const ids: string[] = [];
    for (const [name, mode] of members) ids.push(await idOf(name, mode ? { modelSelection: mode } : {}));
    const cto = await idOf('CTO', {}, ids);
    const project = fleet.useCases.createProject.execute({
      organizationId: ORG,
      details: { name: 'Demo', description: '', workspacePath: '/tmp/fleet-test-workspace' },
      memberIds: [cto, ...ids],
    });
    return { cto, ids, project };
  };

  const assign = (projectId: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: `/api/projects/${projectId}/tasks`, payload });

  const runOf = (agentName: string, index = 0) =>
    fleet.runtime.requests.filter((r) => r.systemPromptAppendix.includes(`You are "${agentName}"`))[index];

  const subtasks = async (projectId: string): Promise<TaskDto[]> => {
    const tree = (await app.inject({ method: 'GET', url: `/api/projects/${projectId}/tasks` })).json();
    return tree[0].children;
  };

  const delegateAndWait = async (members: [string, 'fixed' | 'auto' | undefined][], choices: Record<string, Choice>) => {
    delegations = choices;
    const { cto, project } = await team(members);
    const root = await assign(project.id, { agentId: cto, title: 'Go', description: 'Go' });
    await eventually(() => expect(fleet.useCases.getTask.execute(root.json().id).status).toBe('completed'));
    return { project, cto, rootId: root.json().id as string };
  };

  describe('delegation', () => {
    it('ignores the invoker choice for a fixed agent', async () => {
      const { project } = await delegateAndWait([['Dev', 'fixed']], { Dev: { model: 'opus', effort: 'max' } });

      expect(runOf('Dev')).toMatchObject({ model: 'sonnet', effort: 'high' });
      expect((await subtasks(project.id))[0]?.modelChoice).toEqual({ model: null, effort: null });
    });

    it('treats agents created without modelSelection as fixed', async () => {
      await delegateAndWait([['Dev', undefined]], { Dev: { model: 'opus', effort: 'max' } });

      expect(runOf('Dev')).toMatchObject({ model: 'sonnet', effort: 'high' });
    });

    it('uses the full choice for an auto agent and stores it on the subtask', async () => {
      const { project } = await delegateAndWait([['Dev', 'auto']], { Dev: { model: 'haiku', effort: 'low' } });

      expect(runOf('Dev')).toMatchObject({ model: 'haiku', effort: 'low' });
      expect((await subtasks(project.id))[0]?.modelChoice).toEqual({ model: 'haiku', effort: 'low' });
    });

    it('falls back to the agent effort when only the model is chosen', async () => {
      const { project } = await delegateAndWait([['Dev', 'auto']], { Dev: { model: 'opus' } });

      expect(runOf('Dev')).toMatchObject({ model: 'opus', effort: 'high' });
      expect((await subtasks(project.id))[0]?.modelChoice).toEqual({ model: 'opus', effort: null });
    });

    it('falls back to the agent model when only the effort is chosen', async () => {
      const { project } = await delegateAndWait([['Dev', 'auto']], { Dev: { effort: 'max' } });

      expect(runOf('Dev')).toMatchObject({ model: 'sonnet', effort: 'max' });
      expect((await subtasks(project.id))[0]?.modelChoice).toEqual({ model: null, effort: 'max' });
    });

    it('uses the agent defaults when an auto agent gets no choice', async () => {
      const { project } = await delegateAndWait([['Dev', 'auto']], { Dev: {} });

      expect(runOf('Dev')).toMatchObject({ model: 'sonnet', effort: 'high' });
      expect((await subtasks(project.id))[0]?.modelChoice).toEqual({ model: null, effort: null });
    });

    it('resolves each collaborator independently in the same run', async () => {
      const { project } = await delegateAndWait(
        [
          ['Auto', 'auto'],
          ['Fixed', 'fixed'],
        ],
        { Auto: { model: 'haiku' }, Fixed: { model: 'haiku' } },
      );

      expect(runOf('Auto')?.model).toBe('haiku');
      expect(runOf('Fixed')?.model).toBe('sonnet');
      const choices = Object.fromEntries((await subtasks(project.id)).map((s) => [s.title, s.modelChoice.model]));
      expect(choices).toEqual({ 'Auto work': 'haiku', 'Fixed work': null });
    });

    it('rejects invalid model or effort values without creating a subtask', async () => {
      delegations = { Dev: { model: 'gpt-4', effort: 'max' } };
      const { cto, project } = await team([['Dev', 'auto']]);
      behaviours.CTO = async (request) => {
        const attempts = [{ model: 'gpt-4' }, { effort: 'ultra' }, { model: 42 }];
        const outcomes = await Promise.allSettled(
          attempts.map((a) =>
            request.delegation.delegate({ collaboratorName: 'Dev', title: 't', instructions: 'i', ...a } as DelegationRequest),
          ),
        );
        return outcomes.every((o) => o.status === 'rejected') ? 'all rejected' : 'some accepted';
      };

      const root = await assign(project.id, { agentId: cto, title: 'Go', description: 'Go' });

      await eventually(() => expect(fleet.useCases.getTask.execute(root.json().id).status).not.toBe('running'));
      expect(await subtasks(project.id)).toEqual([]);
      expect(runOf('Dev')).toBeUndefined();
    });
  });

  describe('project manager assignment', () => {
    const assigned = async (mode: 'auto' | 'fixed', choice: Record<string, unknown>) => {
      const { ids, project } = await team([['Dev', mode]]);
      const res = await assign(project.id, { agentId: ids[0], title: 'T', description: 'D', ...choice });
      return { res, project, devId: ids[0] as string };
    };

    it('applies the choice for an auto agent', async () => {
      const { res } = await assigned('auto', { model: 'opus', effort: 'xhigh' });

      expect(res.statusCode).toBe(201);
      expect(res.json().modelChoice).toEqual({ model: 'opus', effort: 'xhigh' });
      await eventually(() => expect(runOf('Dev')).toMatchObject({ model: 'opus', effort: 'xhigh' }));
    });

    it('ignores the choice for a fixed agent', async () => {
      const { res } = await assigned('fixed', { model: 'opus', effort: 'xhigh' });

      expect(res.statusCode).toBe(201);
      expect(res.json().modelChoice).toEqual({ model: null, effort: null });
      await eventually(() => expect(runOf('Dev')).toMatchObject({ model: 'sonnet', effort: 'high' }));
    });

    it('treats null and omitted values as no choice', async () => {
      const { res } = await assigned('auto', { model: null, effort: null });

      expect(res.statusCode).toBe(201);
      expect(res.json().modelChoice).toEqual({ model: null, effort: null });
      await eventually(() => expect(runOf('Dev')).toMatchObject({ model: 'sonnet', effort: 'high' }));
    });

    it.each([{ model: 'gpt-4' }, { effort: 'ultra' }, { model: 5 }, { effort: ['max'] }])(
      'answers 400 to %j and creates no task',
      async (bad) => {
        for (const mode of ['auto', 'fixed'] as const) {
          const { res, project } = await assigned(mode, bad);
          expect(res.statusCode).toBe(400);
          expect(fleet.useCases.getTaskTree.execute(project.id)).toEqual([]);
        }
      },
    );

    it('does not apply a stored choice after the agent goes back to fixed', async () => {
      const { devId, project } = await assigned('auto', { model: 'opus', effort: 'max' });
      await eventually(() => expect(runOf('Dev')).toBeDefined());
      const [task] = fleet.useCases.getTaskTree.execute(project.id);
      await eventually(() => expect(fleet.useCases.getTask.execute(task!.id).status).toBe('completed'));
      const current = (await app.inject({ method: 'GET', url: `/api/agents/${devId}` })).json();
      const update = await app.inject({
        method: 'PUT',
        url: `/api/agents/${devId}`,
        payload: { ...current, modelSelection: 'fixed' },
      });
      expect(update.statusCode).toBe(200);

      fleet.useCases.sendFollowUp.execute(task!.id, 'again');

      await eventually(() => expect(fleet.runtime.requests.length).toBe(2));
      expect(runOf('Dev', 1)).toMatchObject({ model: 'sonnet', effort: 'high' });
    });
  });

  describe('follow-up and recovery', () => {
    it('reuses the stored choice on follow-up', async () => {
      const { ids, project } = await team([['Dev', 'auto']]);
      const res = await assign(project.id, { agentId: ids[0], title: 'T', description: 'D', model: 'haiku', effort: 'low' });
      const id = res.json().id as string;
      await eventually(() => expect(fleet.useCases.getTask.execute(id).status).toBe('completed'));

      fleet.useCases.sendFollowUp.execute(id, 'more');

      await eventually(() => expect(fleet.runtime.requests.length).toBe(2));
      expect(runOf('Dev', 1)).toMatchObject({ model: 'haiku', effort: 'low', resumeSessionId: expect.any(String) });
    });

    it('keeps the choice of a recovered interrupted task for its follow-up', async () => {
      behaviours.Dev = (request) => waitForAbort(request.signal);
      const { ids, project } = await team([['Dev', 'auto']]);
      const res = await assign(project.id, { agentId: ids[0], title: 'T', description: 'D', model: 'opus', effort: 'max' });
      const id = res.json().id as string;
      await eventually(() => expect(runOf('Dev')).toBeDefined());

      expect(fleet.recoverInterruptedTasks.execute()).toBe(1);

      expect(fleet.useCases.getTask.execute(id).status).toBe('failed');
      expect(((await app.inject({ method: 'GET', url: `/api/tasks/${id}` })).json() as TaskDto).modelChoice).toEqual({
        model: 'opus',
        effort: 'max',
      });
      behaviours.Dev = () => 'done';
      fleet.useCases.sendFollowUp.execute(id, 'retry');
      await eventually(() => expect(fleet.runtime.requests.length).toBe(2));
      expect(runOf('Dev', 1)).toMatchObject({ model: 'opus', effort: 'max' });
    });

    it('keeps the choice of a delegated subtask on follow-up', async () => {
      const { project } = await delegateAndWait([['Dev', 'auto']], { Dev: { model: 'haiku', effort: 'low' } });
      const [sub] = await subtasks(project.id);

      fleet.useCases.sendFollowUp.execute(sub!.id, 'more');

      await eventually(() => expect(runOf('Dev', 1)).toMatchObject({ model: 'haiku', effort: 'low' }));
    });
  });

  describe('agent API, export and import', () => {
    it('defaults modelSelection to fixed and rejects invalid values', async () => {
      const id = await idOf('Plain');
      const dto = (await app.inject({ method: 'GET', url: `/api/agents/${id}` })).json();
      expect(dto.modelSelection).toBe('fixed');

      for (const bad of ['smart', 1, null]) {
        expect((await createAgent(`Bad${String(bad)}`, { modelSelection: bad })).statusCode).toBe(400);
      }
    });

    const exportAll = async (): Promise<AgentExportDto> =>
      (await app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents/export`, payload: {} })).json();

    it('roundtrips modelSelection through export and import', async () => {
      await idOf('AutoOne', { modelSelection: 'auto' });
      await idOf('FixedOne');
      const file = await exportAll();
      expect(Object.fromEntries(file.agents.map((a) => [a.name, a.modelSelection]))).toEqual({
        AutoOne: 'auto',
        FixedOne: 'fixed',
      });
      const other = (
        await app.inject({ method: 'POST', url: '/api/organizations', payload: { name: 'Other' } })
      ).json().id as string;

      const imported = await app.inject({ method: 'POST', url: `/api/organizations/${other}/agents/import`, payload: { file } });

      expect(imported.statusCode).toBe(200);
      const list = (await app.inject({ method: 'GET', url: `/api/organizations/${other}/agents` })).json();
      expect(Object.fromEntries(list.map((a: { name: string; modelSelection: string }) => [a.name, a.modelSelection]))).toEqual({
        AutoOne: 'auto',
        FixedOne: 'fixed',
      });
    });

    it('imports an old file without modelSelection as fixed and rejects invalid values', async () => {
      const base = {
        format: 'agent-fleet/agents',
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        organization: 'Old',
      };
      const oldAgent = { ...profile('Legacy'), collaborators: [] };
      const ok = await app.inject({
        method: 'POST',
        url: `/api/organizations/${ORG}/agents/import`,
        payload: { file: { ...base, agents: [oldAgent] } },
      });
      expect(ok.statusCode).toBe(200);
      const list = (await app.inject({ method: 'GET', url: `/api/organizations/${ORG}/agents` })).json();
      expect(list.find((a: { name: string }) => a.name === 'Legacy').modelSelection).toBe('fixed');

      const bad = await app.inject({
        method: 'POST',
        url: `/api/organizations/${ORG}/agents/import`,
        payload: { file: { ...base, agents: [{ ...oldAgent, name: 'Bad', modelSelection: 'smart' }] } },
      });
      expect(bad.statusCode).toBe(400);
    });
  });

  describe('briefing', () => {
    const briefing = () => runOf('CTO')?.systemPromptAppendix ?? '';

    it('mentions model choice only when a collaborator is auto', async () => {
      await delegateAndWait([['Dev', 'fixed']], {});
      const withoutAuto = briefing();
      expect(withoutAuto).not.toMatch(/\bauto\b/i);
      expect(withoutAuto).not.toMatch(/effort/i);
    });

    it('marks the auto collaborator and not the fixed one', async () => {
      await delegateAndWait(
        [
          ['AutoDev', 'auto'],
          ['FixedDev', 'fixed'],
        ],
        {},
      );
      const lines = briefing().split('\n');
      expect(lines.find((l) => l.includes('AutoDev'))).toMatch(/auto/i);
      expect(lines.find((l) => l.includes('FixedDev'))).not.toMatch(/auto/i);
      expect(briefing()).toMatch(/effort/i);
    });
  });
});
