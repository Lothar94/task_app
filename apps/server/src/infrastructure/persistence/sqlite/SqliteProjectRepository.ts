import type { ProjectRepository } from '../../../application/ports/ProjectRepository.js';
import { Project } from '../../../domain/project/Project.js';
import type { SqliteDatabase } from './openDatabase.js';

interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  workspace_path: string;
  created_at: string;
  archived_at: string | null;
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(project: Project): void {
    const snapshot = project.toSnapshot();
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO projects (id, organization_id, name, description, workspace_path, created_at, archived_at)
           VALUES (@id, @organizationId, @name, @description, @workspacePath, @createdAt, @archivedAt)
           ON CONFLICT(id) DO UPDATE SET name = @name, description = @description,
             workspace_path = @workspacePath, archived_at = @archivedAt`,
        )
        .run({
          ...snapshot,
          createdAt: snapshot.createdAt.toISOString(),
          archivedAt: snapshot.archivedAt?.toISOString() ?? null,
        });
      this.db.prepare('DELETE FROM project_agents WHERE project_id = ?').run(snapshot.id);
      const insertMember = this.db.prepare('INSERT INTO project_agents (project_id, agent_id) VALUES (?, ?)');
      for (const memberId of snapshot.memberIds) insertMember.run(snapshot.id, memberId);
    })();
  }

  findById(id: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    return row ? this.toProject(row) : null;
  }

  findByOrganization(organizationId: string): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at DESC')
      .all(organizationId) as ProjectRow[];
    return rows.map((row) => this.toProject(row));
  }

  findByMember(agentId: string): Project[] {
    const rows = this.db
      .prepare(
        `SELECT p.* FROM projects p JOIN project_agents pa ON pa.project_id = p.id
         WHERE pa.agent_id = ?`,
      )
      .all(agentId) as ProjectRow[];
    return rows.map((row) => this.toProject(row));
  }

  private toProject(row: ProjectRow): Project {
    return Project.restore({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      workspacePath: row.workspace_path,
      memberIds: this.memberIdsOf(row.id),
      createdAt: new Date(row.created_at),
      archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    });
  }

  private memberIdsOf(projectId: string): string[] {
    const rows = this.db
      .prepare('SELECT agent_id FROM project_agents WHERE project_id = ?')
      .all(projectId) as { agent_id: string }[];
    return rows.map((row) => row.agent_id);
  }
}
