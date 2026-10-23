import { describe, expect, it } from 'vitest';
import { budgetUsage, mcpServersInUse, namesSummary } from './fleetTilesModel';
import { agentFixture } from './agentTestData';

const budget = (monthToDateCostUsd: number, monthlyLimitUsd: number | null) => ({
  month: '2026-10',
  monthToDateCostUsd,
  monthlyLimitUsd,
});

describe('fleet tiles model', () => {
  it('grades the month-to-date spending against the limit', () => {
    expect(budgetUsage(budget(10, null))).toBeNull();
    expect(budgetUsage(budget(10, 100))).toEqual({ ratio: 0.1, level: 'ok' });
    expect(budgetUsage(budget(80, 100))?.level).toBe('near');
    expect(budgetUsage(budget(120, 100))?.level).toBe('over');
    expect(budgetUsage(budget(0, 0))?.level).toBe('over');
  });

  it('counts distinct MCP servers of enabled agents only', () => {
    const agents = [
      agentFixture({ mcpServers: ['git', 'docker'] }),
      agentFixture({ mcpServers: ['git'] }),
      agentFixture({ mcpServers: ['secret'], enabled: false }),
    ];
    expect(mcpServersInUse(agents)).toEqual(['docker', 'git']);
  });

  it('summarises long name lists', () => {
    expect(namesSummary(['a', 'b'])).toBe('a + b');
    expect(namesSummary(['a', 'b', 'c', 'd', 'e'])).toBe('a + b + c +2');
  });
});
