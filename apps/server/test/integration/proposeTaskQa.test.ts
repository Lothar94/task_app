import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { TASK_LIMITS } from '@fleet/shared';
import type { DelegationGateway, TaskProposal } from '../../src/application/ports/AgentRuntime.js';
import { DEFAULT_ORGANIZATION_ID, migrate } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import { SqliteTaskRepository } from '../../src/infrastructure/persistence/sqlite/SqliteTaskRepository.js';
import { createFleetToolServer } from '../../src/infrastructure/runtime/claude/FleetToolServer.js';
import { createTeamProject, createTestFleet, eventually, profile } from '../support/testFleet.js';
import { waitForAbort } from '../support/FakeAgentRuntime.js';

type ToolHandler = (args: Record<string, unknown>, extra: unknown) => Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}>;

/** Calls the registered MCP tool handler of an in-process fleet server. */
function toolHandler(gateway: DelegationGateway, name: string): ToolHandler {
  const server = createFleetToolServer(gateway) as unknown as {
    instance: { _registeredTools: Record<string, { handler: ToolHandler }> };
  };
  return server.instance._registeredTools[name]!.handler;
}

describe('create_task MCP handler', () => {
  let received: TaskProposal[];
  let failWith: Error | null;
  const gateway = {
    proposeTask: (proposal: TaskProposal) => {
      received.push(proposal);
      if (failWith) throw failWith;
      return { taskId: 'x', taskNumber: 7, assigneeName: proposal.assigneeName ?? 'Me' };
    },
  } as unknown as DelegationGateway;

  beforeEach(() => {
    received = [];
    failWith = null;
  });

  it('invokes the gateway and returns success text', async () => {
    const result = await toolHandler(gateway, 'create_task')(
      { title: 'T', description: 'D', assignee: 'Dev', milestone: 'M', tags: ['a'] },
      {},
    );
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Task 7 created as a draft assigned to "Dev"');
    expect(received).toEqual([
      { title: 'T', description: 'D', assigneeName: 'Dev', milestone: 'M', tags: ['a'] },
    ]);
  });

  it('turns gateway errors into isError results', async () => {
    failWith = new Error('boom');
    const result = await toolHandler(gateway, 'create_task')({ title: 'T', description: 'D' }, {});
    expect(result).toMatchObject({ isError: true, content: [{ text: 'boom' }] });
  });
});

describe('create_task end to end through the real gateway', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let projectId: string;
  let ctoId: string;
  let call: ((args: Record<string, unknown>) => ReturnType<ToolHandler>) | null;
  let results: Awaited<ReturnType<ToolHandler>>[];
  let hold: boolean;

  beforeEach(async () => {
    results = [];
    call = null;
    hold = false;
    fleet = createTestFleet({
      CTO: async (request) => {
        if (call) results.push(await call({}));
        if (hold) await waitForAbort(request.signal);
        return 'done';
      },
    });
    const team = await createTeamProject(fleet, ['Dev']);
    projectId = team.project.id;
    ctoId = team.cto.id;
  });

  const runWith = async (args: Record<string, unknown>) => {
    call = () => {
      const delegation = fleet.runtime.requests.at(-1)!.delegation;
      return toolHandler(delegation, 'create_task')(args, {});
    };
    const task = fleet.useCases.assignTask.execute(projectId, { agentId: ctoId, title: 'A', description: 'd' });
    await eventually(() => expect(results).toHaveLength(1));
    return task;
  };

  it('creates a draft and reports success', async () => {
    await runWith({ title: 'New', description: 'D', assignee: ' Dev ' });
    expect(results[0]!.isError).toBeFalsy();
    expect(results[0]!.content[0]!.text).toContain('Task 2 created as a draft assigned to "Dev"');
  });

  it.each([
    ['unknown assignee', { title: 'T', description: 'D', assignee: 'Nobody' }, /not a member/],
    ['empty title', { title: '  ', description: 'D' }, /title/],
    ['title over limit', { title: 'x'.repeat(TASK_LIMITS.titleLength + 1), description: 'D' }, /title/],
    [
      'too many tags',
      { title: 'T', description: 'D', tags: Array.from({ length: TASK_LIMITS.maxTags + 1 }, (_, i) => `t${i}`) },
      /tags/,
    ],
  ])('returns isError on %s and creates nothing', async (_name, args, message) => {
    await runWith(args);
    expect(results[0]!.isError).toBe(true);
    expect(results[0]!.content[0]!.text).toMatch(message);
    expect(fleet.useCases.getTaskTree.execute(projectId)).toHaveLength(1);
  });

  it('matches assignee names like delegate_task: trimmed and case-insensitive', async () => {
    let delegated: Awaited<ReturnType<ToolHandler>> | null = null;
    call = async () => {
      const delegation = fleet.runtime.requests.at(-1)!.delegation;
      delegated = await toolHandler(delegation, 'delegate_task')(
        { collaborator: '  dEv ', title: 'x', instructions: 'y' },
        {},
      );
      return toolHandler(delegation, 'create_task')({ title: 'T', description: 'D', assignee: '  dEv ' }, {});
    };
    fleet.useCases.assignTask.execute(projectId, { agentId: ctoId, title: 'A', description: 'd' });
    await eventually(() => expect(results).toHaveLength(1));
    expect(delegated).toMatchObject({ isError: false });
    expect(results[0]!.isError).toBeFalsy();
    expect(results[0]!.content[0]!.text).toContain('assigned to "Dev"');
  });

  it('rejects an agent of the same organization that is not a project member', async () => {
    await fleet.useCases.createAgent.execute({
      organizationId: DEFAULT_ORGANIZATION_ID,
      profile: profile('Outsider'),
      collaboratorIds: [],
    });
    await runWith({ title: 'T', description: 'D', assignee: 'Outsider' });
    expect(results[0]).toMatchObject({ isError: true });
    expect(results[0]!.content[0]!.text).toBe('"Outsider" is not a member of this project');
  });

  it('leaves the proposer running, not waiting, and the proposal out of its subtree', async () => {
    hold = true;
    const task = await runWith({ title: 'New', description: 'D' });
    expect(fleet.useCases.getTask.execute(task.id).status).toBe('running');
    const tree = fleet.useCases.getTaskTree.execute(projectId);
    const proposer = tree.find((n) => n.id === task.id)!;
    expect(proposer.children).toEqual([]);
    expect(tree.find((n) => n.number === 2)).toMatchObject({ parentTaskId: null, status: 'draft' });
    fleet.useCases.cancelTask.execute(task.id);
  });

  it('keeps the proposal untouched when the proposer is cancelled', async () => {
    hold = true;
    const task = await runWith({ title: 'New', description: 'D' });
    fleet.useCases.cancelTask.execute(task.id);
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('cancelled'));
    const proposal = fleet.useCases.getTaskTree.execute(projectId).find((n) => n.number === 2)!;
    expect(proposal).toMatchObject({ status: 'draft', proposedByAgentId: ctoId, queuePosition: null });
  });

  it('never auto-starts the draft, but runs it once the manager enqueues it', async () => {
    const task = await runWith({ title: 'New', description: 'D' });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).isFinished).toBe(true));
    fleet.processTaskQueues();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const draft = fleet.useCases.getTaskTree.execute(projectId).find((n) => n.number === 2)!;
    expect(draft.status).toBe('draft');
    expect(fleet.runtime.requests).toHaveLength(1);

    fleet.useCases.enqueueTask.execute(draft.id);
    await eventually(() => expect(fleet.useCases.getTask.execute(draft.id).status).toBe('completed'));
    expect(fleet.runtime.requests).toHaveLength(2);
  });

  it('rejects proposals on archived projects through the tool', async () => {
    await runWith({ title: 'T', description: 'D' });
    fleet.useCases.archiveProject.execute(projectId);
    const result = await toolHandler(fleet.runtime.requests[0]!.delegation, 'create_task')(
      { title: 'T2', description: 'D' },
      {},
    );
    expect(result.isError).toBe(true);
  });
});

describe('proposed_by_agent_id migration', () => {
  it('migrates a previous-version database, old tasks get null proposer', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'fleet-')), 'fleet.db');
    const legacy = new Database(file);
    migrate(legacy, 8);
    legacy.exec(`
      INSERT INTO agents (id, organization_id, name, role, description, instructions, model, effort, allowed_tools,
        skills, permission_mode, max_turns, created_at, updated_at) VALUES ('a1', '${DEFAULT_ORGANIZATION_ID}', 'CTO',
        'Lead', '', 'Lead', 'opus', 'high', '[]', '[]', 'dontAsk', 10, '2026-01-01', '2026-01-01');
      INSERT INTO projects (id, organization_id, name, description, workspace_path, created_at)
        VALUES ('p1', '${DEFAULT_ORGANIZATION_ID}', 'P', '', '/tmp/p', '2026-01-01');
      INSERT INTO tasks (id, number, project_id, agent_id, title, description, status, created_at)
        VALUES ('t1', 1, 'p1', 'a1', 'Old', 'd', 'completed', '2026-01-01');`);
    legacy.close();

    const db = openDatabase(file);
    const task = new SqliteTaskRepository(db).findById('t1');

    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(9);
    expect(task?.toSnapshot().proposedByAgentId).toBeNull();
  });
});
