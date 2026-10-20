import type { AgentDto, ProjectDto, ProjectTelemetryDto } from '@fleet/shared';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';
import { useNow } from '../../hooks/useNow';
import { Badge, Button, FOCUS_RING, StatusChip } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { ActiveSubtaskRow } from './ActiveSubtaskRow';
import { memberNames, type TelemetryByProject } from './projectListModel';
import { CellSkeleton, LoadCell, STATUS_CHIP, StatusCell, plural } from './ProjectTelemetryCells';

const MAX_TEAM_CHIPS = 4;
const COLUMN = 'label-mono px-4 py-2.5 text-left font-normal text-fg-subtle';
const CELL = 'mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3.5 md:align-middle';

function TeamCell({
  project,
  agents,
  activeAgents,
}: {
  project: ProjectDto;
  agents: AgentDto[];
  activeAgents?: number;
}) {
  const names = memberNames(project, agents);
  return (
    <>
      <p className="mb-1.5 font-mono text-xs">
        <span className="font-medium text-fg">{plural(project.memberIds.length, 'agente', 'agentes')}</span>
        {activeAgents ? (
          <span className="text-info"> · {plural(activeAgents, 'activo', 'activos')}</span>
        ) : null}
      </p>
      <ul className="flex flex-wrap gap-1" aria-label="Equipo">
        {names.slice(0, MAX_TEAM_CHIPS).map((name) => (
          <li key={name}>
            <Badge>{name}</Badge>
          </li>
        ))}
        {names.length > MAX_TEAM_CHIPS && (
          <li>
            <Badge>+{names.length - MAX_TEAM_CHIPS}</Badge>
          </li>
        )}
      </ul>
    </>
  );
}

function rowAppearance(project: ProjectDto, telemetry?: ProjectTelemetryDto) {
  if (project.archivedAt) return { chip: null, dot: 'bg-fg-subtle', tint: '' };
  const chip = telemetry ? STATUS_CHIP[telemetry.status] : null;
  return {
    chip,
    dot: chip?.dot ?? 'bg-success',
    tint: telemetry?.status === 'attention' ? 'bg-warning-soft' : '',
  };
}

function NameCell({ project, telemetry }: { project: ProjectDto; telemetry?: ProjectTelemetryDto }) {
  const { chip, dot } = rowAppearance(project, telemetry);
  return (
    <>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
        <Link
          to={`/projects/${project.id}`}
          className={`truncate text-base font-semibold text-fg hover:text-accent ${FOCUS_RING}`}
        >
          {project.name}
        </Link>
        {chip && (
          <StatusChip tone={chip.tone} pulse={chip.pulse}>
            {chip.label}
          </StatusChip>
        )}
        {project.archivedAt && (
          <>
            <Badge>Archivado</Badge>
            <span className="font-mono text-xs whitespace-nowrap text-fg-subtle">
              {formatDate(project.archivedAt)}
            </span>
          </>
        )}
      </div>
      {project.description && (
        <p className="mt-1 line-clamp-1 pl-[1.125rem] text-sm text-fg-muted">{project.description}</p>
      )}
      <p className="mt-1.5 truncate pl-[1.125rem] font-mono text-xs text-fg-subtle">
        {project.workspacePath}
      </p>
    </>
  );
}

function ActionsCell({
  project,
  canResume,
  onResume,
}: {
  project: ProjectDto;
  canResume: boolean;
  onResume: (project: ProjectDto) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      {canResume && (
        <Button
          variant="secondary"
          className="!px-2.5 !py-1 font-mono text-xs"
          aria-label={`Reanudar ${project.name}`}
          onClick={() => onResume(project)}
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Reanudar
        </Button>
      )}
      <Link
        to={`/projects/${project.id}`}
        aria-label={`Abrir ${project.name}`}
        className={`inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1 font-mono text-xs text-fg hover:border-fg-subtle hover:bg-fg/5 ${FOCUS_RING}`}
      >
        Abrir
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

interface RowProps {
  project: ProjectDto;
  agents: AgentDto[];
  telemetry?: ProjectTelemetryDto;
  loading: boolean;
  now: number;
  onResume: (project: ProjectDto) => void;
}

/** Archived projects keep their numbers but expose no live subtask nor resume action. */
function liveState(project: ProjectDto, telemetry?: ProjectTelemetryDto) {
  const live = project.archivedAt ? undefined : telemetry;
  return { subtask: live?.activeSubtask ?? null, canResume: (live?.alerts.length ?? 0) > 0 };
}

function ProjectRow({ project, agents, telemetry, loading, now, onResume }: RowProps) {
  const { tint } = rowAppearance(project, telemetry);
  const { subtask, canResume } = liveState(project, telemetry);
  const skeleton = loading && !telemetry;
  return (
    <Fragment>
      <tr
        className={`block p-4 transition-colors hover:bg-surface-hover md:table-row md:p-0 ${subtask ? '' : 'border-b border-line last:border-b-0'} ${tint}`}
      >
        <td className="block min-w-0 md:table-cell md:w-[34%] md:px-4 md:py-3.5 md:align-middle">
          <NameCell project={project} telemetry={telemetry} />
        </td>
        <td className={`${CELL} md:w-[18%]`}>
          <TeamCell project={project} agents={agents} activeAgents={telemetry?.activeAgentIds.length} />
        </td>
        <td className={`${CELL} md:w-[18%]`}>
          {skeleton && <CellSkeleton />}
          {telemetry && <StatusCell telemetry={telemetry} />}
        </td>
        <td className={`${CELL} md:w-[18%]`}>
          {skeleton && <CellSkeleton />}
          {telemetry && <LoadCell telemetry={telemetry} now={now} />}
        </td>
        <td className={`${CELL} md:text-right`}>
          <ActionsCell project={project} canResume={canResume} onResume={onResume} />
        </td>
      </tr>
      {subtask && <ActiveSubtaskRow projectId={project.id} subtask={subtask} now={now} tint={tint} />}
    </Fragment>
  );
}

export function ProjectTable({
  projects,
  agents,
  telemetry,
  loading = false,
  onResume,
}: {
  projects: ProjectDto[];
  agents: AgentDto[];
  telemetry: TelemetryByProject;
  loading?: boolean;
  onResume: (project: ProjectDto) => void;
}) {
  const now = useNow(telemetry.size > 0);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="block w-full md:table">
        <thead className="max-md:sr-only md:table-header-group">
          <tr className="border-b border-line bg-surface-raised/50">
            <th scope="col" className={COLUMN}>
              Proyecto &amp; workspace local
            </th>
            <th scope="col" className={COLUMN}>
              Equipo de agentes
            </th>
            <th scope="col" className={COLUMN}>
              Estado / telemetría
            </th>
            <th scope="col" className={COLUMN}>
              Consumo &amp; carga
            </th>
            <th scope="col" className={`${COLUMN} text-right`}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              agents={agents}
              telemetry={telemetry.get(project.id)}
              loading={loading}
              now={now}
              onResume={onResume}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
