import { describe, expect, it } from 'vitest';
import type { AgentRunRequest } from '../../src/application/ports/AgentRuntime.js';
import { waitForAbort } from '../support/FakeAgentRuntime.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

const delegateTo = (request: AgentRunRequest, collaboratorName: string) =>
  request.delegation.delegate({
    collaboratorName,
    title: `${collaboratorName} work`,
    instructions: 'Build it',
  });

describe('task delegation', () => {
  it('lets the CTO split work between collaborators in parallel and collect their results', async () => {
    const statusesSeen: string[] = [];
    const fleet = createTestFleet({
      CTO: async (request) => {
        const outcomes = await Promise.all([delegateTo(request, 'Backend'), delegateTo(request, 'Frontend')]);
        request.delegation.reportResult(outcomes.map((outcome) => outcome.summary).join(' + '));
        return 'final text';
      },
      Backend: () => 'api ready',
      Frontend: () => 'ui ready',
    });
    fleet.events.subscribe((event) => {
      if (event.type === 'task.updated' && event.task.parentTaskId === null)
        statusesSeen.push(event.task.status);
    });
    const { cto, project } = await createTeamProject(fleet, ['Backend', 'Frontend']);

    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Ship',
      description: 'Ship it',
    });

    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
    const [tree] = fleet.useCases.getTaskTree.execute(project.id);
    expect(tree?.resultSummary).toBe('api ready + ui ready');
    expect(tree?.children.map((child) => [child.title, child.status])).toEqual([
      ['Backend work', 'completed'],
      ['Frontend work', 'completed'],
    ]);
    expect(statusesSeen).toContain('waiting_subtasks');
  });

  it('numbers tasks and subtasks sequentially within each project', async () => {
    const fleet = createTestFleet({
      CTO: async (request) => {
        await Promise.all([delegateTo(request, 'Backend'), delegateTo(request, 'Frontend')]);
        return 'done';
      },
    });
    const { cto, project } = await createTeamProject(fleet, ['Backend', 'Frontend']);
    const first = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'One',
      description: 'Go',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(first.id).status).toBe('completed'));

    const second = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Two',
      description: 'Go',
    });

    const [tree] = fleet.useCases.getTaskTree.execute(project.id);
    expect([tree?.number, ...(tree?.children.map((child) => child.number) ?? [])]).toEqual([1, 2, 3]);
    expect(second.number).toBe(4);
    expect(fleet.runtime.requests[0]?.prompt).toContain('# Task 1: One');
  });

  it('records an independent conversation for every task', async () => {
    const fleet = createTestFleet({ CTO: (request) => delegateTo(request, 'Backend').then(() => 'ok') });
    const { cto, project } = await createTeamProject(fleet, ['Backend']);
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });

    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
    const [tree] = fleet.useCases.getTaskTree.execute(project.id);
    const subtaskId = tree?.children[0]?.id ?? '';
    const subtaskConversation = fleet.useCases.getTaskConversation.execute(subtaskId);
    expect(subtaskConversation[0]?.payload).toMatchObject({ kind: 'user' });
    expect(JSON.stringify(subtaskConversation[0]?.payload)).toContain('your teammate \\"CTO\\"');
    expect(subtaskConversation.map((message) => message.taskId)).toEqual(
      subtaskConversation.map(() => subtaskId),
    );
  });

  it('runs each agent with its own model and effort', async () => {
    const fleet = createTestFleet();
    const { cto, project } = await createTeamProject(fleet, []);
    fleet.useCases.updateAgent.execute(cto.id, { ...cto.toSnapshot(), model: 'opus', effort: 'xhigh' });

    fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });

    await eventually(() =>
      expect(fleet.runtime.requests[0]).toMatchObject({ model: 'opus', effort: 'xhigh' }),
    );
  });

  it('only exposes collaborators that belong to the project', async () => {
    const fleet = createTestFleet();
    const { cto, project } = await createTeamProject(fleet, ['Backend', 'Frontend']);
    fleet.useCases.setProjectMembers.execute(project.id, [cto.id, project.memberIds[1] ?? '']);

    fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });

    expect(fleet.runtime.requests[0]?.delegation.listCollaborators().map((c) => c.name)).toEqual(['Backend']);
  });

  it('rejects delegating to an agent that is not a collaborator', async () => {
    let failure = '';
    const fleet = createTestFleet({
      CTO: (request) =>
        delegateTo(request, 'Stranger').then(
          () => 'unexpected',
          (error: Error) => (failure = error.message),
        ),
    });
    const { cto, project } = await createTeamProject(fleet, ['Backend']);
    await fleet.useCases.createAgent.execute({
      profile: { ...cto.toSnapshot(), name: 'Stranger' },
      collaboratorIds: [],
    });

    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });

    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
    expect(failure).toMatch(/not one of your collaborators/);
  });

  it('prevents delegating back to an agent higher in the chain', async () => {
    let failure = '';
    const fleet = createTestFleet({
      CTO: (request) => delegateTo(request, 'Backend').then((outcome) => outcome.summary),
      Backend: (request) =>
        delegateTo(request, 'CTO').then(
          () => 'unexpected',
          (error: Error) => (failure = error.message),
        ),
    });
    const { cto, members, project } = await createTeamProject(fleet, ['Backend']);
    fleet.useCases.setAgentCollaborators.execute(members[0]?.id ?? '', [cto.id]);

    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });

    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
    expect(failure).toMatch(/cycle/);
  });

  it('cancels a task together with the subtasks it delegated', async () => {
    const fleet = createTestFleet({
      CTO: (request) => delegateTo(request, 'Backend').then(() => 'never'),
      Backend: (request) => waitForAbort(request.signal),
    });
    const { cto, project } = await createTeamProject(fleet, ['Backend']);
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });
    await eventually(() =>
      expect(fleet.useCases.getTaskTree.execute(project.id)[0]?.children).toHaveLength(1),
    );

    fleet.useCases.cancelTask.execute(root.id);

    await eventually(() => {
      const [tree] = fleet.useCases.getTaskTree.execute(project.id);
      expect(tree?.status).toBe('cancelled');
      expect(tree?.children[0]?.status).toBe('cancelled');
    });
  });

  it('resumes the agent session when the project manager sends a follow-up', async () => {
    const fleet = createTestFleet();
    const { cto, project } = await createTeamProject(fleet, []);
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));

    fleet.useCases.sendFollowUp.execute(root.id, 'Please also add docs');

    await eventually(() => expect(fleet.runtime.requests).toHaveLength(2));
    expect(fleet.runtime.requests[1]).toMatchObject({
      prompt: 'Please also add docs',
      resumeSessionId: 'session-CTO-1',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
  });

  it('marks tasks left running by a previous process as failed', async () => {
    const fleet = createTestFleet({ CTO: (request) => waitForAbort(request.signal) });
    const { cto, project } = await createTeamProject(fleet, []);
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });

    expect(fleet.recoverInterruptedTasks.execute()).toBe(1);
    expect(fleet.useCases.getTask.execute(root.id).status).toBe('failed');
  });
});

describe('shared machine safety', () => {
  it('tells agents which ports belong to the app', async () => {
    const fleet = createTestFleet({}, 4, [4100, 5173]);
    const { cto, project } = await createTeamProject(fleet, []);

    fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });

    await eventually(() =>
      expect(fleet.runtime.requests[0]?.systemPromptAppendix).toContain(
        'Ports in use by the coordinating app, never use or touch them: 4100, 5173',
      ),
    );
  });
});

describe('task metrics', () => {
  it('records each run with its token usage and exposes it on the task tree', async () => {
    const fleet = createTestFleet({ CTO: (request) => delegateTo(request, 'Backend').then(() => 'ok') });
    const { cto, project } = await createTeamProject(fleet, ['Backend']);
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));

    const [tree] = fleet.useCases.getTaskTree.execute(project.id);

    expect(tree?.metrics).toMatchObject({ runs: 1, inputTokens: 100, outputTokens: 50, totalTokens: 1160 });
    expect(tree?.children[0]?.metrics.runs).toBe(1);
    expect(
      fleet.useCases.getUsageDashboard.execute({ projectId: project.id, days: null }).totals,
    ).toMatchObject({
      completed: 2,
      totalTokens: 2320,
    });
  });

  it('records interrupted tasks as failed runs', async () => {
    const fleet = createTestFleet({ CTO: (request) => waitForAbort(request.signal) });
    const { cto, project } = await createTeamProject(fleet, []);
    fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });

    fleet.recoverInterruptedTasks.execute();

    expect(fleet.useCases.getUsageDashboard.execute({ projectId: null, days: null }).errors).toEqual([
      expect.objectContaining({ error: 'Interrupted: the server stopped while the task was running' }),
    ]);
  });
});
