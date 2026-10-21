import type { AgentEffort, AgentModel, AgentPermissionMode, ModelSelectionMode } from '@fleet/shared';
import type { AgentRepository } from '../../../application/ports/AgentRepository.js';
import { Agent, type AgentSnapshot } from '../../../domain/agent/Agent.js';
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
  model_selection: ModelSelectionMode;
  allowed_tools: string;
  skills: string;
  permission_mode: AgentPermissionMode;
  max_turns: number;
  created_at: string;
  updated_at: string;
}

export class SqliteAgentRepository implements AgentRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(agent: Agent): void {
    this.saveAll([agent]);
  }

  saveAll(agents: readonly Agent[]): void {
    this.db.transaction(() => {
      const snapshots = agents.map((agent) => agent.toSnapshot());
      for (const snapshot of snapshots) this.upsert(snapshot);
      for (const snapshot of snapshots) this.replaceRelations(snapshot);
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

  private upsert(snapshot: AgentSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO agents (id, organization_id, name, role, description, instructions, model, effort, model_selection, allowed_tools, skills,
           permission_mode, max_turns, created_at, updated_at)
         VALUES (@id, @organizationId, @name, @role, @description, @instructions, @model, @effort, @modelSelection, @allowedTools, @skills,
           @permissionMode, @maxTurns, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET name = @name, role = @role, description = @description,
           instructions = @instructions, model = @model, effort = @effort, model_selection = @modelSelection, allowed_tools = @allowedTools,
           skills = @skills, permission_mode = @permissionMode, max_turns = @maxTurns, updated_at = @updatedAt`,
      )
      .run({
        ...snapshot,
        allowedTools: JSON.stringify(snapshot.allowedTools),
        skills: JSON.stringify(snapshot.skills),
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      });
  }

  /** Runs after every agent of the batch exists, so links between them satisfy the foreign keys. */
  private replaceRelations(snapshot: AgentSnapshot): void {
    this.db.prepare('DELETE FROM agent_relations WHERE agent_id = ?').run(snapshot.id);
    const insertRelation = this.db.prepare(
      'INSERT INTO agent_relations (agent_id, collaborator_id) VALUES (?, ?)',
    );
    for (const collaboratorId of snapshot.collaboratorIds) insertRelation.run(snapshot.id, collaboratorId);
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
      modelSelection: row.model_selection,
      allowedTools: JSON.parse(row.allowed_tools) as string[],
      skills: JSON.parse(row.skills) as string[],
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
