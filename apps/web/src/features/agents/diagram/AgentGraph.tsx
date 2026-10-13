import type { AgentDto } from '@fleet/shared';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../../components/ui';
import { EFFORT_LABELS } from '../agentLabels';
import { DEFAULT_LAYOUT, type GraphEdge, type GraphNode, layoutAgentGraph } from './agentGraphLayout';

const { nodeWidth: W, nodeHeight: H } = DEFAULT_LAYOUT;
const BACK_EDGE_BULGE = 48;

interface AgentGraphProps {
  agents: AgentDto[];
  highlightedIds?: Set<string>;
  onSelect: (agentId: string) => void;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function edgePath(from: GraphNode, to: GraphNode, isBack: boolean): string {
  if (isBack) {
    const startX = from.x + W;
    const endX = to.x + W;
    const bulge = Math.max(startX, endX) + BACK_EDGE_BULGE;
    return `M ${startX} ${from.y + H / 2} C ${bulge} ${from.y + H / 2}, ${bulge} ${to.y + H / 2}, ${endX + 4} ${to.y + H / 2}`;
  }
  const [x1, y1, x2, y2] = [from.x + W / 2, from.y + H, to.x + W / 2, to.y - 4];
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

function Edge({ edge, nodes, state }: { edge: GraphEdge; nodes: Map<string, GraphNode>; state: EdgeState }) {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (!from || !to) return null;
  return (
    <path
      d={edgePath(from, to, edge.isBack)}
      fill="none"
      strokeWidth={state === 'active' ? 2.5 : 1.5}
      strokeDasharray={edge.isBack ? '6 4' : undefined}
      markerEnd={`url(#arrow-${state})`}
      className={`transition-opacity ${EDGE_STYLES[state]}`}
    />
  );
}

type EdgeState = 'idle' | 'active' | 'dimmed';
const EDGE_STYLES: Record<EdgeState, string> = {
  idle: 'stroke-zinc-600',
  active: 'stroke-indigo-400',
  dimmed: 'stroke-zinc-700 opacity-30',
};
const MARKER_FILLS: Record<EdgeState, string> = {
  idle: 'fill-zinc-600',
  active: 'fill-indigo-400',
  dimmed: 'fill-zinc-700',
};

function AgentNode(props: {
  agent: AgentDto;
  node: GraphNode;
  isWorking: boolean;
  isDimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { agent, node, isWorking, isDimmed, onHover, onSelect } = props;
  return (
    <g
      role="link"
      tabIndex={0}
      aria-label={`${agent.name}, ${agent.role}`}
      transform={`translate(${node.x} ${node.y})`}
      className={`cursor-pointer outline-none transition-opacity ${isDimmed ? 'opacity-40' : ''}`}
      onMouseEnter={() => onHover(agent.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(agent.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => event.key === 'Enter' && onSelect(agent.id)}
    >
      {isWorking && (
        <rect
          x={-4}
          y={-4}
          width={W + 8}
          height={H + 8}
          rx={14}
          className="animate-pulse fill-none stroke-sky-400"
          strokeWidth={2}
        />
      )}
      <rect
        width={W}
        height={H}
        rx={10}
        className="fill-zinc-900 stroke-zinc-700 hover:stroke-indigo-400"
        strokeWidth={1.5}
      />
      <text x={12} y={22} className="fill-zinc-100 text-[13px] font-semibold">
        {clip(agent.name, 22)}
      </text>
      <text x={12} y={40} className="fill-zinc-400 text-[11px]">
        {clip(agent.role, 28)}
      </text>
      <text x={12} y={57} className="fill-zinc-500 font-mono text-[10px]">
        {agent.model} · {EFFORT_LABELS[agent.effort].toLowerCase()}
        {isWorking ? ' · trabajando' : ''}
      </text>
    </g>
  );
}

function ArrowMarkers() {
  return (
    <defs>
      {(Object.keys(EDGE_STYLES) as EdgeState[]).map((state) => (
        <marker
          key={state}
          id={`arrow-${state}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className={MARKER_FILLS[state]} />
        </marker>
      ))}
    </defs>
  );
}

/** Diagram of the fleet: each arrow means "delegates to". */
export function AgentGraph({ agents, highlightedIds = new Set(), onSelect }: AgentGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const layout = useMemo(() => layoutAgentGraph(agents), [agents]);
  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

  if (agents.length === 0) return <EmptyState>No hay agentes que mostrar.</EmptyState>;

  const touchesHovered = (edge: GraphEdge) => edge.from === hoveredId || edge.to === hoveredId;
  const neighbours = new Set(layout.edges.filter(touchesHovered).flatMap((edge) => [edge.from, edge.to]));
  const edgeState = (edge: GraphEdge): EdgeState =>
    !hoveredId ? 'idle' : touchesHovered(edge) ? 'active' : 'dimmed';

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width + BACK_EDGE_BULGE} ${layout.height}`}
          width={layout.width + BACK_EDGE_BULGE}
          className="mx-auto block max-w-full"
          role="img"
          aria-label="Diagrama de delegación entre agentes"
        >
          <ArrowMarkers />
          {layout.edges.map((edge) => (
            <Edge key={`${edge.from}-${edge.to}`} edge={edge} nodes={nodesById} state={edgeState(edge)} />
          ))}
          {layout.nodes.map((node) => {
            const agent = agentsById.get(node.id);
            if (!agent) return null;
            return (
              <AgentNode
                key={node.id}
                agent={agent}
                node={node}
                isWorking={highlightedIds.has(node.id)}
                isDimmed={hoveredId !== null && hoveredId !== node.id && !neighbours.has(node.id)}
                onHover={setHoveredId}
                onSelect={onSelect}
              />
            );
          })}
        </svg>
      </div>
      <figcaption className="text-center text-xs text-zinc-500">
        Las flechas indican «delega en»; las discontinuas cierran un ciclo. Haz clic en un agente para ver su
        ficha.
      </figcaption>
    </figure>
  );
}
