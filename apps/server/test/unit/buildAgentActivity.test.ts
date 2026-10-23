import type { TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { type ActivityTask, buildAgentActivity } from '../../src/application/fleet/buildAgentActivity.js';

const now = new Date('2026-10-23T10:00:00.000Z');
const agents = [{ id: 'cto' }, { id: 'dev' }, { id: 'qa' }];

let counter = 0;
function task(agentId: string, status: TaskStatus, overrides: Partial<ActivityTask> = {}): ActivityTask {
  counter += 1;
  return {
    id: `t${counter}`,
    projectId: 'p1',
    number: counter,
    title: `Task ${counter}`,
    agentId,
    parentTaskId: null,
    status,
    startedAt: status === 'pending' || status === 'draft' || status === 'queued' ? null : now,
    ...overrides,
  };
}
const at = (minute: number) => new Date(Date.UTC(2026, 9, 23, 9, minute));

describe('buildAgentActivity', () => {
  it('lists nobody when no task is running or waiting', () => {
    const statuses: TaskStatus[] = ['pending', 'draft', 'queued', 'completed', 'failed', 'cancelled'];
    expect(
      buildAgentActivity(
        'org',
        agents,
        statuses.map((status) => task('dev', status)),
        now,
      ),
    ).toEqual({
      organizationId: 'org',
      agents: [],
      delegations: [],
      generatedAt: now.toISOString(),
    });
  });

  it('marks an agent with a running task as working on the one started last', () => {
    const older = task('dev', 'running', { startedAt: at(1) });
    const newer = task('dev', 'running', { startedAt: at(5) });
    const waiting = task('dev', 'waiting_subtasks', { startedAt: at(9) });

    const { agents: live } = buildAgentActivity('org', agents, [older, newer, waiting], now);

    expect(live).toEqual([
      {
        agentId: 'dev',
        state: 'working',
        currentTask: { taskId: newer.id, projectId: 'p1', number: newer.number, title: newer.title },
        activeTasks: 3,
      },
    ]);
  });

  it('marks an agent that only waits for subtasks as delegating on its latest waiting task', () => {
    const first = task('cto', 'waiting_subtasks', { startedAt: at(1) });
    const second = task('cto', 'waiting_subtasks', { startedAt: at(2) });

    const [cto] = buildAgentActivity('org', agents, [first, second], now).agents;

    expect(cto).toMatchObject({ agentId: 'cto', state: 'delegating', activeTasks: 2 });
    expect(cto?.currentTask.taskId).toBe(second.id);
  });

  it('lists the delegations in flight from the waiting parent to each active subtask', () => {
    const parent = task('cto', 'waiting_subtasks');
    const running = task('dev', 'running', { parentTaskId: parent.id });
    const pending = task('qa', 'pending', { parentTaskId: parent.id });
    const done = task('qa', 'completed', { parentTaskId: parent.id });

    const { delegations } = buildAgentActivity('org', agents, [done, pending, running, parent], now);

    expect(delegations).toEqual([
      { fromAgentId: 'cto', toAgentId: 'dev', taskId: running.id },
      { fromAgentId: 'cto', toAgentId: 'qa', taskId: pending.id },
    ]);
  });

  it('ignores subtasks whose parent is not waiting for them', () => {
    const parent = task('cto', 'running');
    const subtask = task('dev', 'pending', { parentTaskId: parent.id });
    expect(buildAgentActivity('org', agents, [parent, subtask], now).delegations).toEqual([]);
  });

  it('sorts the agents by id and leaves out unknown ones', () => {
    const tasks = [task('qa', 'running'), task('ghost', 'running'), task('cto', 'running')];
    const ids = buildAgentActivity('org', [...agents].reverse(), tasks, now).agents.map(
      (agent) => agent.agentId,
    );
    expect(ids).toEqual(['cto', 'qa']);
  });

  it('is deterministic whatever the order of the tasks', () => {
    const parent = task('cto', 'waiting_subtasks');
    const tasks = [
      parent,
      task('dev', 'running', { parentTaskId: parent.id, startedAt: at(3) }),
      task('dev', 'running', { parentTaskId: parent.id, startedAt: at(3) }),
      task('qa', 'running', { parentTaskId: parent.id }),
    ];
    const forward = buildAgentActivity('org', agents, tasks, now);
    const backward = buildAgentActivity('org', agents, [...tasks].reverse(), now);
    expect(backward).toEqual(forward);
  });
});
