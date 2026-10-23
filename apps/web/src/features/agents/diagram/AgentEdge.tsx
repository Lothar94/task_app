import { DEFAULT_LAYOUT, type GraphEdge, type GraphNode } from './agentGraphLayout';

const { nodeWidth: W, nodeHeight: H } = DEFAULT_LAYOUT;
export const BACK_EDGE_BULGE = 48;

export type EdgeState = 'idle' | 'active' | 'dimmed';
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
/** A delegation in progress: marching dashes, or a static accent line under reduced motion. */
export const LIVE_EDGE_CLASS = 'stroke-accent motion-safe:[stroke-dasharray:6_4] motion-safe:animate-march';

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

function edgeClass(state: EdgeState, isLive: boolean) {
  if (!isLive) return EDGE_STYLES[state];
  return `${LIVE_EDGE_CLASS} ${state === 'dimmed' ? 'opacity-30' : ''}`;
}

export function AgentEdge({
  edge,
  nodes,
  state,
  isLive,
}: {
  edge: GraphEdge;
  nodes: Map<string, GraphNode>;
  state: EdgeState;
  isLive: boolean;
}) {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (!from || !to) return null;
  const marker = isLive ? 'active' : state;
  return (
    <path
      d={edgePath(from, to, edge.isBack)}
      fill="none"
      strokeWidth={state === 'active' || isLive ? 2.5 : 1.5}
      strokeDasharray={edge.isBack ? '6 4' : undefined}
      markerEnd={`url(#arrow-${marker})`}
      data-live={isLive || undefined}
      className={`transition-opacity ${edgeClass(state, isLive)}`}
    />
  );
}

export function ArrowMarkers() {
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
