import type { Project } from '../../domain/project/Project.js';

export interface ProjectRepository {
  save(project: Project): void;
  findById(id: string): Project | null;
  findByOrganization(organizationId: string): Project[];
  findByMember(agentId: string): Project[];
}
