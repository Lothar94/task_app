import type { AgentDto } from '@fleet/shared';
import { Link, useNavigate } from 'react-router';
import {
  EmptyState,
  ErrorMessage,
  LinkButton,
  Loading,
  PageHeader,
  SegmentedControl,
} from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { useAgents } from './agentQueries';
import { EFFORT_LABELS } from './agentLabels';
import { AgentGraph } from './diagram/AgentGraph';

const VIEWS = ['list', 'diagram'] as const;
const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Lista' },
  { value: 'diagram' as const, label: 'Diagrama' },
];

function AgentCard({ agent, teammates }: { agent: AgentDto; teammates: Map<string, string> }) {
  const collaborators = agent.collaboratorIds.map((id) => teammates.get(id)).filter(Boolean);
  return (
    <Link
      to={`/agents/${agent.id}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-indigo-500/60"
    >
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
    </Link>
  );
}

function AgentList({ agents }: { agents: AgentDto[] }) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} teammates={names} />
      ))}
    </div>
  );
}

export function AgentsPage() {
  const agents = useAgents();
  const navigate = useNavigate();
  const [view, setView] = useStoredChoice('fleet.agents.view', VIEWS, 'list');
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
            <LinkButton to="/agents/new">Nuevo agente</LinkButton>
          </>
        }
      />
      {agents.data.length === 0 ? (
        <EmptyState>
          Aún no hay agentes. Crea uno o ejecuta `make seed` para cargar un equipo de ejemplo.
        </EmptyState>
      ) : view === 'diagram' ? (
        <AgentGraph agents={agents.data} onSelect={(id) => navigate(`/agents/${id}`)} />
      ) : (
        <AgentList agents={agents.data} />
      )}
    </>
  );
}
