import { describe, expect, it } from 'vitest';
import { activeAgentsLabel, delegationKeys, liveStatusById, newestActivity } from './agentActivityModel';
import { activityFixture } from './agentTestData';

describe('agent activity model', () => {
  it('keeps the most recent snapshot', () => {
    const older = activityFixture({ generatedAt: '2026-10-23T10:00:00.000Z' });
    const newer = activityFixture({ generatedAt: '2026-10-23T10:00:01.000Z' });
    expect(newestActivity(older, newer)).toBe(newer);
    expect(newestActivity(newer, older)).toBe(newer);
    expect(newestActivity(older, undefined)).toBe(older);
  });

  it('indexes live states and delegations', () => {
    const currentTask = { taskId: 't', projectId: 'p', number: 1, title: 'X' };
    const activity = activityFixture({
      agents: [{ agentId: 'a1', state: 'delegating', activeTasks: 1, currentTask }],
      delegations: [{ fromAgentId: 'a1', toAgentId: 'a2', taskId: 's' }],
    });
    expect(liveStatusById(activity).get('a1')?.state).toBe('delegating');
    expect(delegationKeys(activity).has('a1→a2')).toBe(true);
    expect(liveStatusById(undefined).size).toBe(0);
  });

  it('labels the active count', () => {
    expect(activeAgentsLabel(1)).toBe('1 activo');
    expect(activeAgentsLabel(3)).toBe('3 activos');
  });
});
