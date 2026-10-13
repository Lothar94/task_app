import type { Project } from '../../domain/project/Project.js';

export interface ProjectRepository {
  save(project: Project): void;
  findById(id: string): Project | null;
  findAll(): Project[];
  findByMember(agentId: string): Project[];
}
