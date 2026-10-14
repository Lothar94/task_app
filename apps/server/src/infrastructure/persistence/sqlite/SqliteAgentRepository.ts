import type { AgentEffort, AgentModel, AgentPermissionMode } from '@fleet/shared';
import type { AgentRepository } from '../../../application/ports/AgentRepository.js';
import { Agent } from '../../../domain/agent/Agent.js';
import type { SqliteDatabase } from './openDatabase.js';

interface AgentRow {
  id: string;
  organization_id: string;
  name: string;
  role: string;
  description: string;
  instructions: string;
  model: AgentModel;
  effort: AgentEffort;
  allowed_tools: string;
  permission_mode: AgentPermissionMode;
  max_turns: number;
  created_at: string;
  updated_at: string;
}

export class SqliteAgentRepository implements AgentRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(agent: Agent): void {
    const snapshot = agent.toSnapshot();
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO agents (id, organization_id, name, role, description, instructions, model, effort, allowed_tools,
             permission_mode, max_turns, created_at, updated_at)
           VALUES (@id, @organizationId, @name, @role, @description, @instructions, @model, @effort, @allowedTools,
             @permissionMode, @maxTurns, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET name = @name, role = @role, description = @description,
             instructions = @instructions, model = @model, effort = @effort, allowed_tools = @allowedTools,
             permission_mode = @permissionMode, max_turns = @maxTurns, updated_at = @updatedAt`,
        )
        .run({
          ...snapshot,
          allowedTools: JSON.stringify(snapshot.allowedTools),
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString(),
        });
      this.db.prepare('DELETE FROM agent_relations WHERE agent_id = ?').run(snapshot.id);
      const insertRelation = this.db.prepare(
        'INSERT INTO agent_relations (agent_id, collaborator_id) VALUES (?, ?)',
      );
      for (const collaboratorId of snapshot.collaboratorIds) insertRelation.run(snapshot.id, collaboratorId);
    })();
  }

  findById(id: string): Agent | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
    return row ? this.toAgent(row) : null;
  }

  findByName(organizationId: string, name: string): Agent | null {
    const row = this.db
      .prepare('SELECT * FROM agents WHERE organization_id = ? AND name = ?')
      .get(organizationId, name) as AgentRow | undefined;
    return row ? this.toAgent(row) : null;
  }

  findByOrganization(organizationId: string): Agent[] {
    const rows = this.db
      .prepare('SELECT * FROM agents WHERE organization_id = ? ORDER BY created_at')
      .all(organizationId) as AgentRow[];
    return rows.map((row) => this.toAgent(row));
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  }

  private toAgent(row: AgentRow): Agent {
    return Agent.restore({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      role: row.role,
      description: row.description,
      instructions: row.instructions,
      model: row.model,
      effort: row.effort,
      allowedTools: JSON.parse(row.allowed_tools) as string[],
      permissionMode: row.permission_mode,
      maxTurns: row.max_turns,
      collaboratorIds: this.collaboratorIdsOf(row.id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private collaboratorIdsOf(agentId: string): string[] {
    const rows = this.db
      .prepare('SELECT collaborator_id FROM agent_relations WHERE agent_id = ?')
      .all(agentId) as { collaborator_id: string }[];
    return rows.map((row) => row.collaborator_id);
  }
}
