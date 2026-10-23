import type { AgentDto, AgentLiveStatusDto } from '@fleet/shared';
import { agentInitials } from '../AgentAvatar';
import { modelEffortText, modelText } from '../agentLabels';
import { DEFAULT_LAYOUT, type GraphNode } from './agentGraphLayout';

const { nodeWidth: W, nodeHeight: H } = DEFAULT_LAYOUT;
const AVATAR = 36;
const TEXT_X = 12 + AVATAR + 10;
const TAG_HEIGHT = 16;
const ORCHESTRATOR_TAG_WIDTH = 84;
const DISABLED_TAG_WIDTH = 84;
/** Approximate advance of a 10px mono glyph, to clip chip texts to their box. */
const MONO_CHAR_WIDTH = 6.2;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const ACCENT_HALO = '[filter:drop-shadow(0_0_6px_color-mix(in_srgb,var(--color-accent)_55%,transparent))]';
const SUCCESS_HALO = '[filter:drop-shadow(0_0_8px_color-mix(in_srgb,var(--color-success)_60%,transparent))]';

export const LIVE_STATE_LABELS: Record<AgentLiveStatusDto['state'], string> = {
  working: 'trabajando',
  delegating: 'delegando',
};

export const isDisabled = (agent: Pick<AgentDto, 'enabled'>) => agent.enabled === false;

export interface AgentNodeProps {
  agent: AgentDto;
  node: GraphNode;
  /** Live status from the agent activity; undefined means idle. */
  live?: AgentLiveStatusDto;
  isWorking: boolean;
  isActive: boolean;
  isDimmed: boolean;
  selectable: boolean;
  isSelected: boolean;
  showStatus: boolean;
  isOrchestrator: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function nodeLabel({ agent, live, showStatus, isWorking, isOrchestrator }: AgentNodeProps) {
  const parts = [agent.name, agent.role];
  if (isOrchestrator) parts.push('orquestador');
  if (isDisabled(agent)) parts.push('desactivado');
  if (live) parts.push(`${LIVE_STATE_LABELS[live.state]}, en curso: ${live.currentTask.title}`);
  else if (showStatus) parts.push(isWorking ? 'trabajando' : 'idle');
  return parts.join(', ');
}

function modelLine(agent: AgentDto, showStatus: boolean, isWorking: boolean) {
  if (showStatus)
    return `${isWorking ? '●' : '○'} ${isWorking ? 'trabajando' : 'idle'} · ${modelText(agent)}`;
  return modelEffortText(agent);
}

function NodeTag(props: { x: number; y: number; width: number; text: string; box: string; label: string }) {
  const { x, y, width, text, box, label } = props;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={TAG_HEIGHT} className={box} />
      <text
        x={width / 2}
        y={TAG_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className={`font-mono text-[10px] font-semibold ${label}`}
      >
        {text}
      </text>
    </g>
  );
}

/** "EN CURSO: <task>" chip on the top-left edge, clipped to the room the orchestrator tag leaves. */
function LiveChip({ live, isOrchestrator }: { live: AgentLiveStatusDto; isOrchestrator: boolean }) {
  const width = isOrchestrator ? W - ORCHESTRATOR_TAG_WIDTH - 20 : W - 24;
  const text = clip(`EN CURSO: ${live.currentTask.title}`, Math.floor((width - 12) / MONO_CHAR_WIDTH));
  return (
    <g data-live-chip transform={`translate(12 ${-TAG_HEIGHT / 2 - 1})`}>
      <rect width={width} height={TAG_HEIGHT} className="fill-canvas stroke-success" />
      <text
        x={6}
        y={TAG_HEIGHT / 2}
        dominantBaseline="central"
        className="fill-success font-mono text-[10px]"
      >
        {text}
      </text>
    </g>
  );
}

/** Disabled agents are dimmed with a dashed frame on the canvas colour, keeping text contrast. */
function frameClass({ agent, live, isActive, isWorking, isSelected }: AgentNodeProps) {
  if (live) return `fill-surface stroke-success ${SUCCESS_HALO}`;
  const pulse = isWorking ? 'motion-safe:animate-pulse' : '';
  if (isActive || isWorking || isSelected) return `fill-surface stroke-accent ${ACCENT_HALO} ${pulse}`;
  return isDisabled(agent)
    ? 'fill-canvas stroke-line-strong [stroke-dasharray:4_3]'
    : 'fill-surface stroke-line-strong';
}

function NodeTitle({ agent, live, isWorking }: Pick<AgentNodeProps, 'agent' | 'live' | 'isWorking'>) {
  if (live)
    return (
      <title>{`${agent.name}: ${LIVE_STATE_LABELS[live.state]} · EN CURSO: ${live.currentTask.title}`}</title>
    );
  if (isWorking) return <title>{`${agent.name}: trabajando`}</title>;
  return null;
}

function NodeBody({
  agent,
  showStatus,
  isWorking,
}: Pick<AgentNodeProps, 'agent' | 'showStatus' | 'isWorking'>) {
  return (
    <>
      <g className={isDisabled(agent) ? 'opacity-50' : undefined}>
        <rect
          x={12}
          y={(H - AVATAR) / 2}
          width={AVATAR}
          height={AVATAR}
          rx={0}
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
      </g>
      <text
        x={TEXT_X}
        y={24}
        className={`${isDisabled(agent) ? 'fill-fg-muted' : 'fill-fg'} text-[13px] font-semibold`}
      >
        {clip(agent.name, 20)}
      </text>
      <text x={TEXT_X} y={41} className="fill-fg-muted text-[11px]">
        {clip(agent.role, 26)}
      </text>
      <text x={TEXT_X} y={57} className="fill-fg-subtle font-mono text-[10px]">
        {clip(modelLine(agent, showStatus, isWorking), 26)}
      </text>
    </>
  );
}

function NodeTags({
  agent,
  live,
  isOrchestrator,
}: Pick<AgentNodeProps, 'agent' | 'live' | 'isOrchestrator'>) {
  return (
    <>
      {isOrchestrator && (
        <NodeTag
          x={W - ORCHESTRATOR_TAG_WIDTH}
          y={-TAG_HEIGHT / 2 - 1}
          width={ORCHESTRATOR_TAG_WIDTH}
          text="orquestador"
          box="fill-accent"
          label="fill-surface"
        />
      )}
      {live && <LiveChip live={live} isOrchestrator={isOrchestrator} />}
      {isDisabled(agent) && (
        <NodeTag
          x={W - DISABLED_TAG_WIDTH - 8}
          y={H - TAG_HEIGHT / 2}
          width={DISABLED_TAG_WIDTH}
          text="Desactivado"
          box="fill-canvas stroke-line-strong"
          label="fill-fg-muted"
        />
      )}
    </>
  );
}

export function AgentNode(props: AgentNodeProps) {
  const { agent, node, isDimmed, selectable, isSelected, onHover, onSelect } = props;
  return (
    <g
      data-agent-id={agent.id}
      data-live-state={props.live?.state}
      role={selectable ? 'button' : 'link'}
      aria-pressed={selectable ? isSelected : undefined}
      tabIndex={0}
      aria-label={nodeLabel(props)}
      transform={`translate(${node.x} ${node.y})`}
      className={`cursor-pointer outline-none motion-safe:transition-opacity ${isDimmed ? 'opacity-40' : ''}`}
      onMouseEnter={() => onHover(agent.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(agent.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(agent.id);
      }}
    >
      <rect width={W} height={H} rx={0} strokeWidth={1} className={frameClass(props)} />
      <NodeBody {...props} />
      <NodeTags {...props} />
      <NodeTitle {...props} />
    </g>
  );
}
