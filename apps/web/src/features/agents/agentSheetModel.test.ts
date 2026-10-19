import type { AgentUsageRow } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { agentTrackRecord, isOrchestrator } from './agentSheetModel';

const row = (agentId: string, completed: number, failed: number) =>
  ({ agentId, completed, failed }) as AgentUsageRow;

describe('agent sheet model', () => {
  it('flags agents that delegate as orchestrators', () => {
    expect(isOrchestrator({ collaboratorIds: ['a'] })).toBe(true);
    expect(isOrchestrator({ collaboratorIds: [] })).toBe(false);
  });

  it('derives completed tasks and fail rate from the dashboard row', () => {
    expect(agentTrackRecord([row('a', 3, 1)], 'a')).toEqual({ completed: 3, failRate: 0.25 });
    expect(agentTrackRecord([row('a', 0, 0)], 'a')).toEqual({ completed: 0, failRate: null });
  });

  it('has no record for agents without runs', () => {
    expect(agentTrackRecord([row('a', 1, 0)], 'b')).toBeUndefined();
  });
});
