import type { AgentDto } from '@fleet/shared';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  EmptyState,
  ErrorMessage,
  LinkButton,
  Loading,
  PageHeader,
  SegmentedControl,
} from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { useAgents } from './agentQueries';
import { useAgentExportSelection } from './useAgentExportSelection';
import { ExportToolbar } from './ExportToolbar';
import { EFFORT_LABELS } from './agentLabels';
import { AgentGraph } from './diagram/AgentGraph';

const VIEWS = ['list', 'diagram'] as const;
const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Lista' },
  { value: 'diagram' as const, label: 'Diagrama' },
];

const CARD_STYLES = 'block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition';

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

function AgentCardBody({ agent, teammates }: { agent: AgentDto; teammates: Map<string, string> }) {
  const collaborators = agent.collaboratorIds.map((id) => teammates.get(id)).filter(Boolean);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{agent.name}</h2>
          <p className="text-sm text-zinc-400">{agent.role}</p>
        </div>
        <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-zinc-300">
          {agent.model} · {EFFORT_LABELS[agent.effort].toLowerCase()}
        </span>
      </div>
      {agent.description && <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{agent.description}</p>}
      <p className="mt-3 text-xs text-zinc-500">
        {collaborators.length > 0 ? `Delega en: ${collaborators.join(', ')}` : 'Sin colaboradores'}
      </p>
    </>
  );
}

interface Selection {
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function AgentCard({
  agent,
  teammates,
  selection,
}: {
  agent: AgentDto;
  teammates: Map<string, string>;
  selection?: Selection;
}) {
  const body = <AgentCardBody agent={agent} teammates={teammates} />;
  if (!selection) {
    return (
      <Link to={`/agents/${agent.id}`} className={`${CARD_STYLES} hover:border-indigo-500/60`}>
        {body}
      </Link>
    );
  }
  const checked = selection.selected.has(agent.id);
  return (
    <label
      className={`${CARD_STYLES} cursor-pointer ${checked ? 'border-indigo-500' : 'hover:border-indigo-500/60'}`}
    >
      <input
        type="checkbox"
        className="mb-2"
        checked={checked}
        onChange={() => selection.onToggle(agent.id)}
        aria-label={`Seleccionar ${agent.name}`}
      />
      {body}
    </label>
  );
}

function AgentList({ agents, selection }: { agents: AgentDto[]; selection?: Selection }) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} teammates={names} selection={selection} />
      ))}
    </div>
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
        subtitle="Tu flota: identidad, instrucciones y con quién puede colaborar cada uno."
        actions={
          <>
            <SegmentedControl label="Vista" options={VIEW_OPTIONS} value={view} onChange={setView} />
            {agents.data.length > 0 && !selected && (
              <ExportStarters
                onStart={exporting.start}
                onExportAll={exporting.exportAll}
                isPending={exporting.isPending}
              />
            )}
            <LinkButton to="/agents/new">Nuevo agente</LinkButton>
          </>
        }
      />
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
