import type { AgentDto } from '@fleet/shared';

export type GraphAgent = Pick<AgentDto, 'id' | 'name' | 'collaboratorIds'>;

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  padding: number;
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  level: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** Points to the same or an upper level: part of a cycle or a lateral relation. */
  isBack: boolean;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  nodeWidth: 216,
  nodeHeight: 68,
  gapX: 32,
  gapY: 72,
  padding: 24,
};

function collectEdges(agents: GraphAgent[]): Omit<GraphEdge, 'isBack'>[] {
  const ids = new Set(agents.map((agent) => agent.id));
  return agents.flatMap((agent) =>
    agent.collaboratorIds
      .filter((id) => ids.has(id) && id !== agent.id)
      .map((to) => ({ from: agent.id, to })),
  );
}

/** Assigns each agent a level following the "delegates to" relation, from the top of the hierarchy down. */
function assignLevels(sorted: GraphAgent[], edges: Omit<GraphEdge, 'isBack'>[]): Map<string, number> {
  const outgoing = new Map(sorted.map((agent) => [agent.id, edges.filter((edge) => edge.from === agent.id)]));
  const hasIncoming = new Set(edges.map((edge) => edge.to));
  const connected = sorted.filter((agent) => hasIncoming.has(agent.id) || outgoing.get(agent.id)?.length);
  const roots = connected.filter((agent) => !hasIncoming.has(agent.id));
  const queue = (roots.length > 0 ? roots : connected.slice(0, 1)).map((agent) => agent.id);

  const levels = new Map<string, number>(queue.map((id) => [id, 0]));
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const { to } of outgoing.get(id) ?? []) {
      if (levels.has(to)) continue;
      levels.set(to, (levels.get(id) ?? 0) + 1);
      queue.push(to);
    }
  }

  const leftoverLevel = levels.size > 0 ? Math.max(...levels.values()) + 1 : 0;
  for (const agent of sorted) if (!levels.has(agent.id)) levels.set(agent.id, leftoverLevel);
  return levels;
}

export function layoutAgentGraph(agents: GraphAgent[], options: LayoutOptions = DEFAULT_LAYOUT): GraphLayout {
  const { nodeWidth, nodeHeight, gapX, gapY, padding } = options;
  const sorted = [...agents].sort((a, b) => a.name.localeCompare(b.name));
  const rawEdges = collectEdges(sorted);
  const levels = assignLevels(sorted, rawEdges);

  const rows: GraphAgent[][] = [];
  for (const agent of sorted) (rows[levels.get(agent.id) ?? 0] ??= []).push(agent);
  const filledRows = rows.filter((row) => row.length > 0);
  const widest = Math.max(0, ...filledRows.map((row) => row.length));
  const contentWidth = widest * nodeWidth + Math.max(0, widest - 1) * gapX;

  const nodes = filledRows.flatMap((row, rowIndex) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * gapX;
    const offset = padding + (contentWidth - rowWidth) / 2;
    return row.map((agent, column) => ({
      id: agent.id,
      level: rowIndex,
      x: offset + column * (nodeWidth + gapX),
      y: padding + rowIndex * (nodeHeight + gapY),
    }));
  });
  const levelOf = new Map(nodes.map((node) => [node.id, node.level]));

  return {
    nodes,
    edges: rawEdges.map((edge) => ({
      ...edge,
      isBack: (levelOf.get(edge.to) ?? 0) <= (levelOf.get(edge.from) ?? 0),
    })),
    width: contentWidth + padding * 2,
    height: filledRows.length * nodeHeight + Math.max(0, filledRows.length - 1) * gapY + padding * 2,
  };
}
