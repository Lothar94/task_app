import { isArchivedProject, type ProjectDto } from '@fleet/shared';

export type ProjectFilter = 'active' | 'archived';

export interface ProjectGroups {
  active: ProjectDto[];
  archived: ProjectDto[];
}

const byName = (a: ProjectDto, b: ProjectDto) => a.name.localeCompare(b.name, 'es');

// ISO dates sort lexicographically; most recently archived first.
const byArchivedAtDesc = (a: ProjectDto, b: ProjectDto) =>
  (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '') || byName(a, b);

/** Splits projects into active (by name) and archived (most recently archived first). */
export function groupProjects(projects: ProjectDto[]): ProjectGroups {
  return {
    active: projects.filter((project) => !isArchivedProject(project)).sort(byName),
    archived: projects.filter(isArchivedProject).sort(byArchivedAtDesc),
  };
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
