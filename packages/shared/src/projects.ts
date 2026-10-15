export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  workspacePath: string;
  memberIds: string[];
  createdAt: string;
  /**
   * ISO date the project was archived, or null while it is active. An archived project is read-only:
   * it accepts no new tasks, runs, follow-ups or member changes until it is unarchived.
   */
  archivedAt: string | null;
}

export interface ProjectInput {
  name: string;
  description: string;
  workspacePath: string;
  memberIds: string[];
}

/**
 * Archiving endpoints (both idempotent, both answer 200 with the updated ProjectDto):
 * - POST /api/projects/:id/archive   → 409 CONFLICT while the project has running or queued tasks.
 * - POST /api/projects/:id/unarchive
 * GET /api/organizations/:id/projects keeps returning every project; clients filter by `archivedAt`.
 */
export const isArchivedProject = (project: Pick<ProjectDto, 'archivedAt'>): boolean =>
  project.archivedAt !== null;
