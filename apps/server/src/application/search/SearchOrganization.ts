import type { SearchResultsDto } from '@fleet/shared';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { matchSearch, type SearchCorpus } from './matchSearch.js';

/** Global search over the projects, tasks and agents of one organization. */
export class SearchOrganization {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRepository,
  ) {}

  execute(organizationId: string, query: string, limit?: number): SearchResultsDto {
    requireOrganization(this.organizations, organizationId);
    if (query.trim().length === 0) return matchSearch(emptyCorpus(), query, limit);
    return matchSearch(this.loadCorpus(organizationId), query, limit);
  }

  private loadCorpus(organizationId: string): SearchCorpus {
    const projects = this.projects.findByOrganization(organizationId).map((project) => project.toSnapshot());
    return {
      projects: projects.map((project) => ({
        hit: { id: project.id, name: project.name, archived: project.archivedAt !== null },
        createdAt: project.createdAt,
      })),
      tasks: projects.flatMap((project) =>
        this.tasks.findByProject(project.id).map((task) => {
          const { id, number, title, status, createdAt } = task.toSnapshot();
          return {
            hit: { id, number, title, status, projectId: project.id, projectName: project.name },
            createdAt,
          };
        }),
      ),
      agents: this.agents.findByOrganization(organizationId).map((agent) => {
        const { id, name, role, createdAt } = agent.toSnapshot();
        return { hit: { id, name, role }, createdAt };
      }),
    };
  }
}

function emptyCorpus(): SearchCorpus {
  return { projects: [], tasks: [], agents: [] };
}
