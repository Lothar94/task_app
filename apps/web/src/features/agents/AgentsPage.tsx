import type { AgentActivityDto, AgentDto } from '@fleet/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  LinkButton,
  Loading,
  PageHeader,
  SegmentedControl,
  StatusChip,
} from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { useAgentActivity, useAgents } from './agentQueries';
import { activeAgentsLabel } from './agentActivityModel';
import { AgentInspector } from './AgentInspector';
import { AgentList, type ExportSelection } from './AgentList';
import { useAgentExportSelection } from './useAgentExportSelection';
import { ExportToolbar } from './ExportToolbar';
import { ImportButton } from './ImportButton';

/** Stored under 'fleet.agents.view'; 'list' and 'diagram' predate 'dual' and stay valid. */
const VIEWS = ['list', 'diagram', 'dual'] as const;
type AgentsView = (typeof VIEWS)[number];
const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Lista' },
  { value: 'diagram' as const, label: 'Diagrama' },
  { value: 'dual' as const, label: 'Dual' },
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

function ActiveAgentsBadge({ activity }: { activity?: AgentActivityDto }) {
  if (!activity) return null;
  const count = activity.agents.length;
  return (
    <StatusChip tone={count > 0 ? 'success' : 'neutral'} pulse={count > 0}>
      {activeAgentsLabel(count)}
    </StatusChip>
  );
}

function AgentViews({
  view,
  agents,
  activity,
  selection,
}: {
  view: AgentsView;
  agents: AgentDto[];
  activity?: AgentActivityDto;
  selection?: ExportSelection;
}) {
  if (agents.length === 0) {
    return (
      <EmptyState>
        Aún no hay agentes. Crea uno o ejecuta `make seed` para cargar un equipo de ejemplo.
      </EmptyState>
    );
  }
  if (view === 'list') return <AgentList agents={agents} selection={selection} />;
  return <AgentInspector agents={agents} activity={activity} dual={view === 'dual'} selection={selection} />;
}

export function AgentsPage() {
  const agents = useAgents();
  const activity = useAgentActivity();
  const [view, setView] = useStoredChoice('fleet.agents.view', VIEWS, 'diagram');
  const exporting = useAgentExportSelection(view !== 'diagram');
  const { selected } = exporting;
  if (agents.isPending) return <Loading />;
  if (agents.error) return <ErrorMessage error={agents.error} />;

  return (
    <>
      <PageHeader
        title="Agentes"
        badge={
          <>
            <Badge>{agentCountLabel(agents.data.length)}</Badge>
            <ActiveAgentsBadge activity={activity.data} />
          </>
        }
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
      <AgentViews
        view={view}
        agents={agents.data}
        activity={activity.data}
        selection={selected ? { selected, onToggle: exporting.toggle } : undefined}
      />
    </>
  );
}
