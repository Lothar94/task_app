import type { AgentDto } from '@fleet/shared';
import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  LinkButton,
  Loading,
  PageHeader,
  ROW_CLASS,
  RowList,
  SegmentedControl,
} from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { useAgents } from './agentQueries';
import { useAgentExportSelection } from './useAgentExportSelection';
import { ExportToolbar } from './ExportToolbar';
import { ImportButton } from './ImportButton';
import { EFFORT_LABELS } from './agentLabels';
import { AgentAvatar } from './AgentAvatar';
import { AgentGraph } from './diagram/AgentGraph';

const VIEWS = ['list', 'diagram'] as const;
const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Lista' },
  { value: 'diagram' as const, label: 'Diagrama' },
];

const agentCountLabel = (count: number) => `${count} ${count === 1 ? 'agente' : 'agentes'}`;

function ExportStarters({
  onStart,
  onExportAll,
  isPending,
}: {
  onStart: () => void;
  onExportAll: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <Button variant="secondary" onClick={onStart}>
        Exportar
      </Button>
      <Button variant="secondary" onClick={onExportAll} disabled={isPending}>
        {isPending ? 'Exportando…' : 'Exportar todos'}
      </Button>
    </>
  );
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
      <span className="rounded-sm border border-line-strong bg-surface-raised px-2 py-0.5 font-mono text-xs whitespace-nowrap text-fg-muted">
        {agent.model} · {EFFORT_LABELS[agent.effort].toLowerCase()}
      </span>
    </>
  );
}

interface Selection {
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function AgentRow({
  agent,
  teammates,
  selection,
}: {
  agent: AgentDto;
  teammates: Map<string, string>;
  selection?: Selection;
}) {
  const body = <AgentRowBody agent={agent} teammates={teammates} />;
  if (!selection) {
    return (
      <li>
        <Link to={`/agents/${agent.id}`} className={ROW_CLASS}>
          {body}
        </Link>
      </li>
    );
  }
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

function AgentList({ agents, selection }: { agents: AgentDto[]; selection?: Selection }) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return (
    <RowList>
      {agents.map((agent) => (
        <AgentRow key={agent.id} agent={agent} teammates={names} selection={selection} />
      ))}
    </RowList>
  );
}

export function AgentsPage() {
  const agents = useAgents();
  const navigate = useNavigate();
  const [view, setView] = useStoredChoice('fleet.agents.view', VIEWS, 'list');
  const exporting = useAgentExportSelection(view === 'list');
  const { selected } = exporting;
  if (agents.isPending) return <Loading />;
  if (agents.error) return <ErrorMessage error={agents.error} />;

  return (
    <>
      <PageHeader
        title="Agentes"
        badge={<Badge>{agentCountLabel(agents.data.length)}</Badge>}
        subtitle="Tu flota: identidad, instrucciones y con quién puede colaborar cada uno."
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ImportButton existingAgents={agents.data} disabled={Boolean(selected)} />
              {agents.data.length > 0 && !selected && (
                <ExportStarters
                  onStart={exporting.start}
                  onExportAll={exporting.exportAll}
                  isPending={exporting.isPending}
                />
              )}
            </div>
            <LinkButton to="/agents/new">Nuevo agente</LinkButton>
          </>
        }
      />
      <div className="mb-4">
        <SegmentedControl label="Vista" options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>
      {!selected && <ErrorMessage error={exporting.error} />}
      {selected && (
        <ExportToolbar
          selectedCount={selected.size}
          includeCollaborators={exporting.includeCollaborators}
          isPending={exporting.isPending}
          error={exporting.error}
          onSelectAll={() => exporting.selectAll(agents.data.map((agent) => agent.id))}
          onSelectNone={exporting.selectNone}
          onIncludeCollaboratorsChange={exporting.setIncludeCollaborators}
          onExport={exporting.exportSelected}
          onCancel={exporting.cancel}
        />
      )}
      {agents.data.length === 0 ? (
        <EmptyState>
          Aún no hay agentes. Crea uno o ejecuta `make seed` para cargar un equipo de ejemplo.
        </EmptyState>
      ) : view === 'diagram' ? (
        <AgentGraph agents={agents.data} onSelect={(id) => navigate(`/agents/${id}`)} />
      ) : (
        <AgentList
          agents={agents.data}
          selection={selected ? { selected, onToggle: exporting.toggle } : undefined}
        />
      )}
    </>
  );
}
