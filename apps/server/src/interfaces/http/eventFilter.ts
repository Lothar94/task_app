import type { FleetEvent } from '@fleet/shared';

export interface EventFilterCriteria {
  projectId?: string | undefined;
  organizationId?: string | undefined;
}

/** Organization that owns the project, or null when it does not exist. */
export type ProjectOrganizationLookup = (projectId: string) => string | null;

/**
 * Builds the predicate of one SSE connection. Both criteria are combinable; the organization of each
 * project is resolved once per connection since a project never changes organization. Organization
 * events (`agent.activity`) belong to no project: they pass the filter of their organization and
 * unfiltered connections, never a project filter.
 */
export function createEventFilter(
  { projectId, organizationId }: EventFilterCriteria,
  organizationOf: ProjectOrganizationLookup,
): (event: FleetEvent) => boolean {
  const organizationByProject = new Map<string, string>();

  const belongsToOrganization = (eventProjectId: string): boolean => {
    let owner = organizationByProject.get(eventProjectId);
    if (owner === undefined) {
      const resolved = organizationOf(eventProjectId);
      if (resolved === null) return false;
      organizationByProject.set(eventProjectId, resolved);
      owner = resolved;
    }
    return owner === organizationId;
  };

  return (event) => {
    if (event.type === 'agent.activity') {
      return !projectId && (!organizationId || event.organizationId === organizationId);
    }
    return (
      (!projectId || event.projectId === projectId) &&
      (!organizationId || belongsToOrganization(event.projectId))
    );
  };
}
