import type { AgentDto } from '@fleet/shared';
import { Link } from 'react-router';
import { ROW_CLASS, RowList } from '../../components/ui';
import { AgentAvatar } from './AgentAvatar';
import { modelEffortText } from './agentLabels';

/** Export mode: rows become checkboxes. */
export interface ExportSelection {
  selected: Set<string>;
  onToggle: (id: string) => void;
}

/** Dual view: rows open the agent sheet next to the diagram instead of navigating. */
export interface Inspection {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function AgentRowBody({ agent, teammates }: { agent: AgentDto; teammates: Map<string, string> }) {
  const collaborators = agent.collaboratorIds.map((id) => teammates.get(id)).filter(Boolean);
  return (
    <>
      <AgentAvatar name={agent.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{agent.name}</p>
        <p className="truncate text-sm text-fg-muted">{agent.role}</p>
      </div>
      <p className="hidden min-w-0 max-w-[35%] flex-1 truncate text-xs text-fg-subtle md:block">
        {collaborators.length > 0 ? `Delega en: ${collaborators.join(', ')}` : 'Sin colaboradores'}
      </p>
      {agent.enabled === false && (
        <span className="label-mono border border-line-strong px-1.5 py-0.5 text-fg-muted">Desactivado</span>
      )}
      <span className="rounded-sm border border-line-strong bg-surface-raised px-2 py-0.5 font-mono text-xs whitespace-nowrap text-fg-muted">
        {modelEffortText(agent)}
      </span>
    </>
  );
}

function SelectableRow({
  agent,
  body,
  selection,
}: {
  agent: AgentDto;
  body: React.ReactNode;
  selection: ExportSelection;
}) {
  const checked = selection.selected.has(agent.id);
  return (
    <li>
      <label
        className={`${ROW_CLASS} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent ${checked ? 'bg-accent/10' : ''}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => selection.onToggle(agent.id)}
          aria-label={`Seleccionar ${agent.name}`}
        />
        {body}
      </label>
    </li>
  );
}

function InspectableRow({
  agent,
  body,
  inspection,
}: {
  agent: AgentDto;
  body: React.ReactNode;
  inspection: Inspection;
}) {
  const isSelected = inspection.selectedId === agent.id;
  return (
    <li>
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => inspection.onSelect(agent.id)}
        className={`${ROW_CLASS} w-full text-left ${isSelected ? 'bg-accent/10' : ''}`}
      >
        {body}
      </button>
    </li>
  );
}

function AgentRow(props: {
  agent: AgentDto;
  teammates: Map<string, string>;
  selection?: ExportSelection;
  inspection?: Inspection;
}) {
  const { agent, teammates, selection, inspection } = props;
  const body = <AgentRowBody agent={agent} teammates={teammates} />;
  if (selection) return <SelectableRow agent={agent} body={body} selection={selection} />;
  if (inspection) return <InspectableRow agent={agent} body={body} inspection={inspection} />;
  return (
    <li>
      <Link to={`/agents/${agent.id}`} className={ROW_CLASS}>
        {body}
      </Link>
    </li>
  );
}

export function AgentList({
  agents,
  selection,
  inspection,
}: {
  agents: AgentDto[];
  selection?: ExportSelection;
  inspection?: Inspection;
}) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return (
    <RowList>
      {agents.map((agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          teammates={names}
          selection={selection}
          inspection={inspection}
        />
      ))}
    </RowList>
  );
}
