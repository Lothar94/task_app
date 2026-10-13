import { describe, expect, it } from 'vitest';
import { type GraphAgent, layoutAgentGraph } from './agentGraphLayout';

const agent = (id: string, collaboratorIds: string[] = []): GraphAgent => ({ id, name: id, collaboratorIds });
const levelsOf = (agents: GraphAgent[]) =>
  Object.fromEntries(layoutAgentGraph(agents).nodes.map((node) => [node.id, node.level]));

describe('layoutAgentGraph', () => {
  it('places delegators above the agents they delegate to', () => {
    const team = [agent('Backend'), agent('CTO', ['Backend', 'Frontend']), agent('Frontend')];
    const layout = layoutAgentGraph(team);
    expect(levelsOf(team)).toEqual({
      CTO: 0,
      Backend: 1,
      Frontend: 1,
    });
    expect(layout.edges).toEqual([
      { from: 'CTO', to: 'Backend', isBack: false },
      { from: 'CTO', to: 'Frontend', isBack: false },
    ]);
  });

  it('marks edges that close a cycle', () => {
    const layout = layoutAgentGraph([agent('A', ['B']), agent('B', ['A'])]);
    expect(layout.edges.filter((edge) => edge.isBack)).toEqual([{ from: 'B', to: 'A', isBack: true }]);
  });

  it('puts agents without relations in a final row', () => {
    expect(levelsOf([agent('CTO', ['Backend']), agent('Backend'), agent('Solo')])).toEqual({
      CTO: 0,
      Backend: 1,
      Solo: 2,
    });
  });

  it('centres rows and does not overlap nodes', () => {
    const { nodes, width } = layoutAgentGraph([agent('CTO', ['A', 'B']), agent('A'), agent('B')]);
    const [cto, a, b] = ['CTO', 'A', 'B'].map((id) => nodes.find((node) => node.id === id)!);
    expect(cto!.x).toBeCloseTo((a!.x + b!.x) / 2);
    expect(b!.x - a!.x).toBeGreaterThanOrEqual(184);
    expect(width).toBeGreaterThan(b!.x);
  });

  it('handles an empty fleet', () => {
    expect(layoutAgentGraph([])).toMatchObject({ nodes: [], edges: [] });
  });
});
