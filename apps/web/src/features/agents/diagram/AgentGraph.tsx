import type { AgentActivityDto, AgentDto } from '@fleet/shared';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../../components/ui';
import { delegationKeys, liveStatusById } from '../agentActivityModel';
import { AgentEdge, ArrowMarkers, BACK_EDGE_BULGE, type EdgeState } from './AgentEdge';
import { AgentNode } from './AgentNode';
import { type GraphEdge, type GraphLayout, layoutAgentGraph } from './agentGraphLayout';
import { type DiagramZoom, useDiagramZoom } from './useDiagramZoom';
import { handleZoomKeys, ZoomControls } from './ZoomControls';

interface AgentGraphProps {
  agents: AgentDto[];
  highlightedIds?: Set<string>;
  /** When defined the nodes behave as toggle buttons and the selected one gets a halo. */
  selectedId?: string | null;
  /** Shows a "trabajando"/"idle" status line in each node, driven by `highlightedIds`. */
  showStatus?: boolean;
  /** Marks this node with an "orquestador" tag. */
  orchestratorId?: string | null;
  /** Live state: working agents get a halo and their task, delegations in progress are animated. */
  activity?: AgentActivityDto;
  /** Shows zoom controls (+, −, encajar) next to the caption. */
  zoomable?: boolean;
  onSelect: (agentId: string) => void;
}

const CAPTION =
  'Las flechas indican «delega en»; las discontinuas cierran un ciclo, como el de verificación. Haz clic en un agente para ver su ficha.';

/** Hovering a node highlights its edges and neighbours and dims the rest. */
function useHoverFocus(edges: GraphEdge[]) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const touchesHovered = (edge: GraphEdge) => edge.from === hoveredId || edge.to === hoveredId;
  const neighbours = new Set(edges.filter(touchesHovered).flatMap((edge) => [edge.from, edge.to]));
  return {
    hoveredId,
    setHoveredId,
    edgeState: (edge: GraphEdge): EdgeState =>
      !hoveredId ? 'idle' : touchesHovered(edge) ? 'active' : 'dimmed',
    isDimmed: (id: string) => hoveredId !== null && hoveredId !== id && !neighbours.has(id),
  };
}

function Caption({ zoom }: { zoom?: DiagramZoom }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <figcaption className="min-w-0 flex-1 font-mono text-xs text-fg-subtle">{CAPTION}</figcaption>
      {zoom && <ZoomControls zoom={zoom} />}
    </div>
  );
}

interface GraphCanvasProps extends AgentGraphProps {
  layout: GraphLayout;
  width: number;
  /** Shrinks to the container width; otherwise keeps `width` and the container scrolls. */
  fitted: boolean;
}

function GraphCanvas({ layout, width, fitted, agents, activity, ...props }: GraphCanvasProps) {
  const { highlightedIds, selectedId, showStatus = false, orchestratorId = null, onSelect } = props;
  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const liveById = useMemo(() => liveStatusById(activity), [activity]);
  const liveEdges = useMemo(() => delegationKeys(activity), [activity]);
  const hover = useHoverFocus(layout.edges);
  return (
    <svg
      viewBox={`0 0 ${layout.width + BACK_EDGE_BULGE} ${layout.height}`}
      width={width}
      className={`mx-auto block ${fitted ? 'max-w-full' : 'max-w-none'}`}
      role="img"
      aria-label="Diagrama de delegación entre agentes"
    >
      <ArrowMarkers />
      {layout.edges.map((edge) => (
        <AgentEdge
          key={`${edge.from}-${edge.to}`}
          edge={edge}
          nodes={nodesById}
          state={hover.edgeState(edge)}
          isLive={liveEdges.has(`${edge.from}→${edge.to}`)}
        />
      ))}
      {layout.nodes.map((node) => {
        const agent = agentsById.get(node.id);
        if (!agent) return null;
        return (
          <AgentNode
            key={node.id}
            agent={agent}
            node={node}
            live={liveById.get(node.id)}
            isWorking={highlightedIds?.has(node.id) ?? false}
            isActive={hover.hoveredId === node.id}
            selectable={selectedId !== undefined}
            isSelected={selectedId === node.id}
            showStatus={showStatus}
            isOrchestrator={orchestratorId === node.id}
            isDimmed={hover.isDimmed(node.id)}
            onHover={hover.setHoveredId}
            onSelect={onSelect}
          />
        );
      })}
    </svg>
  );
}

/** Diagram of the fleet: each arrow means "delegates to". */
export function AgentGraph({ zoomable = false, ...props }: AgentGraphProps) {
  const layout = useMemo(() => layoutAgentGraph(props.agents), [props.agents]);
  const contentWidth = layout.width + BACK_EDGE_BULGE;
  const zoom = useDiagramZoom(contentWidth);

  if (props.agents.length === 0) return <EmptyState>No hay agentes que mostrar.</EmptyState>;

  const scale = zoomable ? zoom.scale : 1;
  return (
    <figure className="space-y-4">
      <Caption zoom={zoomable ? zoom : undefined} />
      <div
        ref={zoom.containerRef}
        className="overflow-auto"
        onKeyDown={zoomable ? (event) => handleZoomKeys(zoom, event) : undefined}
      >
        <GraphCanvas
          {...props}
          layout={layout}
          width={contentWidth * scale}
          fitted={!zoomable || zoom.isFit}
        />
      </div>
    </figure>
  );
}
