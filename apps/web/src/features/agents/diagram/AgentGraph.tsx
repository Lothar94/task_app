import type { AgentDto } from '@fleet/shared';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../../components/ui';
import { agentInitials } from '../AgentAvatar';
import { EFFORT_LABELS } from '../agentLabels';
import { DEFAULT_LAYOUT, type GraphEdge, type GraphNode, layoutAgentGraph } from './agentGraphLayout';

const { nodeWidth: W, nodeHeight: H } = DEFAULT_LAYOUT;
const BACK_EDGE_BULGE = 48;
const AVATAR = 36;
const TEXT_X = 12 + AVATAR + 10;

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
  idle: 'stroke-fg-subtle/60',
  active: 'stroke-accent',
  dimmed: 'stroke-fg-subtle/60 opacity-30',
};
const MARKER_FILLS: Record<EdgeState, string> = {
  idle: 'fill-fg-subtle/60',
  active: 'fill-accent',
  dimmed: 'fill-fg-subtle/60',
};

const HALO = '[filter:drop-shadow(0_0_6px_color-mix(in_srgb,var(--color-accent)_55%,transparent))]';

function AgentNode(props: {
  agent: AgentDto;
  node: GraphNode;
  isWorking: boolean;
  isActive: boolean;
  isDimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { agent, node, isWorking, isActive, isDimmed, onHover, onSelect } = props;
  const isHighlighted = isActive || isWorking;
  return (
    <g
      role="link"
      tabIndex={0}
      aria-label={`${agent.name}, ${agent.role}`}
      transform={`translate(${node.x} ${node.y})`}
      className={`cursor-pointer outline-none motion-safe:transition-opacity ${isDimmed ? 'opacity-40' : ''}`}
      onMouseEnter={() => onHover(agent.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(agent.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => event.key === 'Enter' && onSelect(agent.id)}
    >
      <rect
        width={W}
        height={H}
        rx={8}
        strokeWidth={1}
        className={`fill-surface ${isHighlighted ? `stroke-accent ${HALO}` : 'stroke-line-strong'} ${isWorking ? 'motion-safe:animate-pulse' : ''}`}
      />
      <rect
        x={12}
        y={(H - AVATAR) / 2}
        width={AVATAR}
        height={AVATAR}
        rx={4}
        className="fill-surface-raised stroke-line-strong"
      />
      <text
        x={12 + AVATAR / 2}
        y={H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-accent font-mono text-[13px] font-semibold"
      >
        {agentInitials(agent.name)}
      </text>
      <text x={TEXT_X} y={24} className="fill-fg text-[13px] font-semibold">
        {clip(agent.name, 20)}
      </text>
      <text x={TEXT_X} y={41} className="fill-fg-muted text-[11px]">
        {clip(agent.role, 26)}
      </text>
      <text x={TEXT_X} y={57} className="fill-fg-subtle font-mono text-[10px]">
        {clip(`${agent.model} · ${EFFORT_LABELS[agent.effort].toLowerCase()}`, 26)}
      </text>
      {isWorking && <title>{`${agent.name}: trabajando`}</title>}
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
                isActive={hoveredId === node.id}
                isDimmed={hoveredId !== null && hoveredId !== node.id && !neighbours.has(node.id)}
                onHover={setHoveredId}
                onSelect={onSelect}
              />
            );
          })}
        </svg>
      </div>
      <figcaption className="text-center text-xs text-fg-subtle">
        Las flechas indican «delega en»; las discontinuas cierran un ciclo. Haz clic en un agente para ver su
        ficha.
      </figcaption>
    </figure>
  );
}
