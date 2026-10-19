import type { AgentDto, ProjectDto } from '@fleet/shared';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, FOCUS_RING, StatusChip, type ChipTone } from '../../components/ui';
import {
  formatCost,
  formatDate,
  formatDuration,
  formatInteger,
  formatPercent,
  formatTokens,
} from '../../lib/format';
import { formatDistanceLabel } from '../dashboard/timeAgo';
import { memberNames } from './projectListModel';
import type { ProjectStatus, ProjectTelemetry } from './projectTelemetryModel';
import type { ProjectTelemetryState } from './useProjectTelemetry';

const MAX_TEAM_CHIPS = 4;
const COLUMN = 'label-mono px-4 py-2.5 text-left font-normal text-fg-subtle';
const CELL = 'mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3.5 md:align-middle';

const STATUS_CHIP: Record<ProjectStatus, { tone: ChipTone; label: string; dot: string }> = {
  running: { tone: 'info', label: 'En curso', dot: 'bg-info motion-safe:animate-pulse' },
  idle: { tone: 'neutral', label: 'Inactivo', dot: 'bg-fg-subtle' },
  attention: { tone: 'warning', label: 'Atención', dot: 'bg-warning' },
};

function Skeleton({ className }: { className: string }) {
  return (
    <span className={`block animate-pulse bg-surface-hover motion-reduce:animate-none ${className}`}>
      <span className="sr-only">Cargando…</span>
    </span>
  );
}

function CellSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-1.5 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

const plural = (count: number, one: string, many: string) =>
  `${formatInteger(count)} ${count === 1 ? one : many}`;

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

function StatusCell({ telemetry }: { telemetry: ProjectTelemetry }) {
  const { counts, successRate, completedPercent, failedPercent } = telemetry;
  if (counts.total === 0) return <p className="font-mono text-xs text-fg-subtle">Sin tareas</p>;
  return (
    <div className="space-y-1 font-mono text-xs">
      <p className="flex max-w-[9rem] items-center justify-between text-fg-subtle">
        <span>{plural(counts.total, 'tarea', 'tareas')}</span>
        {successRate !== null && <span className="text-success">{formatPercent(successRate)} éxito</span>}
      </p>
      <div
        role="img"
        aria-label={`${formatPercent(completedPercent / 100)} completadas`}
        className="flex h-1.5 w-full max-w-[9rem] overflow-hidden bg-surface-hover"
      >
        <span className="h-full bg-success" style={{ width: `${completedPercent}%` }} />
        <span className="h-full bg-warning" style={{ width: `${failedPercent}%` }} />
      </div>
      <p className="flex flex-wrap gap-x-2 text-fg-subtle">
        <span className="text-success">{formatInteger(counts.completed)} comp.</span>
        {counts.active > 0 && <span className="text-info">{formatInteger(counts.active)} en curso</span>}
        {counts.failed > 0 && (
          <span className="text-warning">{plural(counts.failed, 'fallida', 'fallidas')}</span>
        )}
      </p>
    </div>
  );
}

function LoadCell({ telemetry }: { telemetry: ProjectTelemetry }) {
  return (
    <div className="space-y-0.5 font-mono text-xs text-fg-subtle">
      <p className="font-medium text-fg">{formatTokens(telemetry.tokens)} tokens</p>
      {telemetry.costUsd > 0 && <p>~{formatCost(telemetry.costUsd)}</p>}
      {telemetry.workingMs > 0 && <p>{formatDuration(telemetry.workingMs)} acumulados</p>}
      {telemetry.lastActivityAt && <p>{formatDistanceLabel(telemetry.lastActivityAt)}</p>}
    </div>
  );
}

function rowAppearance(project: ProjectDto, telemetry?: ProjectTelemetry) {
  if (project.archivedAt) return { chip: null, dot: 'bg-fg-subtle', tint: '' };
  const chip = telemetry ? STATUS_CHIP[telemetry.status] : null;
  return {
    chip,
    dot: chip?.dot ?? 'bg-success',
    tint: telemetry?.status === 'attention' ? 'bg-warning-soft' : '',
  };
}

function NameCell({ project, telemetry }: { project: ProjectDto; telemetry?: ProjectTelemetry }) {
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
        {chip && <StatusChip tone={chip.tone}>{chip.label}</StatusChip>}
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

function ProjectRow({
  project,
  agents,
  state,
}: {
  project: ProjectDto;
  agents: AgentDto[];
  state?: ProjectTelemetryState;
}) {
  const telemetry = state?.telemetry;
  const loading = state?.isPending ?? false;
  return (
    <tr
      className={`block border-b border-line p-4 transition-colors last:border-b-0 hover:bg-surface-hover md:table-row md:p-0 ${rowAppearance(project, telemetry).tint}`}
    >
      <td className="block min-w-0 md:table-cell md:w-[34%] md:px-4 md:py-3.5 md:align-middle">
        <NameCell project={project} telemetry={telemetry} />
      </td>
      <td className={`${CELL} md:w-[18%]`}>
        <TeamCell project={project} agents={agents} activeAgents={telemetry?.activeAgents} />
      </td>
      <td className={`${CELL} md:w-[18%]`}>
        {loading && <CellSkeleton />}
        {telemetry && <StatusCell telemetry={telemetry} />}
      </td>
      <td className={`${CELL} md:w-[18%]`}>
        {loading && <CellSkeleton />}
        {telemetry && <LoadCell telemetry={telemetry} />}
      </td>
      <td className={`${CELL} md:text-right`}>
        <Link
          to={`/projects/${project.id}`}
          aria-label={`Abrir ${project.name}`}
          className={`inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1 font-mono text-xs text-fg hover:border-fg-subtle hover:bg-fg/5 ${FOCUS_RING}`}
        >
          Abrir
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </td>
    </tr>
  );
}

export function ProjectTable({
  projects,
  agents,
  telemetry,
}: {
  projects: ProjectDto[];
  agents: AgentDto[];
  telemetry: Map<string, ProjectTelemetryState>;
}) {
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
              state={telemetry.get(project.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
