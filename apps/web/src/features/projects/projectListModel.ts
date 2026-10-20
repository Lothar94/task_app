import { isArchivedProject, type ProjectDto, type ProjectTelemetryDto } from '@fleet/shared';

export type ProjectFilter = 'active' | 'archived' | 'alerts';
export type ProjectSort = 'recent' | 'name' | 'tokens';

export const PROJECT_SORT_LABELS: Record<ProjectSort, string> = {
  recent: 'Reciente',
  name: 'Nombre',
  tokens: 'Consumo',
};

export type TelemetryByProject = ReadonlyMap<string, ProjectTelemetryDto>;

export interface ProjectGroups {
  active: ProjectDto[];
  archived: ProjectDto[];
  /** Non-archived projects with something to resume. */
  alerts: ProjectDto[];
}

const byName = (a: ProjectDto, b: ProjectDto) => a.name.localeCompare(b.name, 'es');

// ISO dates sort lexicographically; most recently archived first.
const byArchivedAtDesc = (a: ProjectDto, b: ProjectDto) =>
  (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '') || byName(a, b);

/** Splits projects into active (by name), archived (most recently archived first) and active with alerts. */
export function groupProjects(
  projects: ProjectDto[],
  telemetry: TelemetryByProject = new Map(),
): ProjectGroups {
  const active = projects.filter((project) => !isArchivedProject(project)).sort(byName);
  return {
    active,
    archived: projects.filter(isArchivedProject).sort(byArchivedAtDesc),
    alerts: active.filter((project) => (telemetry.get(project.id)?.alerts.length ?? 0) > 0),
  };
}

/** Case-insensitive match of the query against project name and workspace path. */
export function filterProjects(projects: ProjectDto[], query: string): ProjectDto[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return projects;
  return projects.filter((project) =>
    [project.name, project.workspacePath].some((text) => text.toLowerCase().includes(needle)),
  );
}

/** Latest activity first, projects without activity last; ties and unknowns fall back to the name. */
function byRecentActivity(telemetry: TelemetryByProject) {
  return (a: ProjectDto, b: ProjectDto) => {
    const lastA = telemetry.get(a.id)?.lastActivityAt ?? null;
    const lastB = telemetry.get(b.id)?.lastActivityAt ?? null;
    if (lastA === lastB) return byName(a, b);
    if (lastA === null) return 1;
    if (lastB === null) return -1;
    return lastB.localeCompare(lastA);
  };
}

const tokensOf = (telemetry: TelemetryByProject, project: ProjectDto) =>
  telemetry.get(project.id)?.totalTokens ?? 0;

/** Returns a sorted copy; the input is left untouched. */
export function sortProjects(
  projects: ProjectDto[],
  sort: ProjectSort,
  telemetry: TelemetryByProject,
): ProjectDto[] {
  const compare = {
    recent: byRecentActivity(telemetry),
    name: byName,
    tokens: (a: ProjectDto, b: ProjectDto) => tokensOf(telemetry, b) - tokensOf(telemetry, a) || byName(a, b),
  }[sort];
  return [...projects].sort(compare);
}

/** "+3 esta semana" / "−2 esta semana"; null when nothing changed. */
export function weeklyDeltaLabel(delta: number): string | null {
  if (delta === 0) return null;
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} esta semana`;
}

const MAX_SWARM_NAMES = 4;

/** Names of the swarm agents (deleted agents skipped), at most four followed by "…". */
export function swarmLabel(agentIds: string[], agents: { id: string; name: string }[]): string | null {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  const known = agentIds.flatMap((id) => names.get(id) ?? []);
  if (known.length === 0) return null;
  return `${known.slice(0, MAX_SWARM_NAMES).join(', ')}${known.length > MAX_SWARM_NAMES ? '…' : ''}`;
}

/** Project label for selectors, flagging archived ones. */
export const projectOptionLabel = (project: ProjectDto): string =>
  isArchivedProject(project) ? `${project.name} (archivado)` : project.name;

export interface ProjectSummary {
  activeProjects: number;
  /** Distinct agents that belong to at least one active project. */
  teamAgents: number;
}

export function summarizeProjects(active: ProjectDto[]): ProjectSummary {
  return {
    activeProjects: active.length,
    teamAgents: new Set(active.flatMap((project) => project.memberIds)).size,
  };
}

/** Names of the project's members, in member order; ids of deleted agents are skipped. */
export function memberNames(project: ProjectDto, agents: { id: string; name: string }[]): string[] {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return project.memberIds.flatMap((id) => names.get(id) ?? []);
}
