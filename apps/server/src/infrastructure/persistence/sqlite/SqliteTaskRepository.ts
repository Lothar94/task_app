import type { AgentEffort, AgentModel, TaskStatus } from '@fleet/shared';
import type { TaskRepository } from '../../../application/ports/TaskRepository.js';
import { Task } from '../../../domain/task/Task.js';
import type { SqliteDatabase } from './openDatabase.js';

interface TaskRow {
  id: string;
  number: number;
  project_id: string;
  parent_task_id: string | null;
  agent_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  result_summary: string | null;
  session_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  milestone: string | null;
  tags: string;
  queue_position: number | null;
  proposed_by_agent_id: string | null;
  model_choice_model: AgentModel | null;
  model_choice_effort: AgentEffort | null;
}

const ACTIVE_STATUSES = "('pending', 'running', 'waiting_subtasks')";
const toDate = (value: string | null): Date | null => (value ? new Date(value) : null);

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(task: Task): void {
    const snapshot = task.toSnapshot();
    this.db
      .prepare(
        `INSERT INTO tasks (id, number, project_id, parent_task_id, agent_id, title, description, status,
           result_summary, session_id, created_at, started_at, finished_at, milestone, tags, queue_position,
           proposed_by_agent_id, model_choice_model, model_choice_effort)
         VALUES (@id, @number, @projectId, @parentTaskId, @agentId, @title, @description, @status,
           @resultSummary, @sessionId, @createdAt, @startedAt, @finishedAt, @milestone, @tags, @queuePosition,
           @proposedByAgentId, @modelChoiceModel, @modelChoiceEffort)
         ON CONFLICT(id) DO UPDATE SET title = @title, description = @description, agent_id = @agentId,
           milestone = @milestone, tags = @tags, queue_position = @queuePosition,
           status = @status, result_summary = @resultSummary,
           session_id = @sessionId, started_at = @startedAt, finished_at = @finishedAt`,
      )
      .run({
        ...snapshot,
        tags: JSON.stringify(snapshot.tags),
        modelChoiceModel: snapshot.modelChoice.model,
        modelChoiceEffort: snapshot.modelChoice.effort,
        createdAt: snapshot.createdAt.toISOString(),
        startedAt: snapshot.startedAt?.toISOString() ?? null,
        finishedAt: snapshot.finishedAt?.toISOString() ?? null,
      });
  }

  nextNumber(projectId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM tasks WHERE project_id = ?')
      .get(projectId) as { next: number };
    return row.next;
  }

  findById(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? toTask(row) : null;
  }

  findByProject(projectId: string): Task[] {
    return this.query('SELECT * FROM tasks WHERE project_id = ? ORDER BY number', projectId);
  }

  findAll(): Task[] {
    return this.query('SELECT * FROM tasks ORDER BY created_at');
  }

  findChildren(parentTaskId: string): Task[] {
    return this.query('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY number', parentTaskId);
  }

  findActive(): Task[] {
    return this.query(`SELECT * FROM tasks WHERE status IN ${ACTIVE_STATUSES}`);
  }

  findQueued(projectId: string): Task[] {
    return this.query(
      "SELECT * FROM tasks WHERE project_id = ? AND status = 'queued' ORDER BY queue_position",
      projectId,
    );
  }

  findProjectIdsWithQueue(): string[] {
    const rows = this.db.prepare("SELECT DISTINCT project_id FROM tasks WHERE status = 'queued'").all();
    return (rows as { project_id: string }[]).map((row) => row.project_id);
  }

  hasActiveRootTask(projectId: string): boolean {
    return (
      this.db
        .prepare(
          `SELECT 1 FROM tasks WHERE project_id = ? AND parent_task_id IS NULL AND status IN ${ACTIVE_STATUSES} LIMIT 1`,
        )
        .get(projectId) !== undefined
    );
  }

  existsForAgent(agentId: string): boolean {
    return this.db.prepare('SELECT 1 FROM tasks WHERE agent_id = ? LIMIT 1').get(agentId) !== undefined;
  }

  private query(sql: string, ...params: string[]): Task[] {
    return (this.db.prepare(sql).all(...params) as TaskRow[]).map(toTask);
  }
}

function toTask(row: TaskRow): Task {
  return Task.restore({
    id: row.id,
    number: row.number,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    agentId: row.agent_id,
    title: row.title,
    description: row.description,
    status: row.status,
    resultSummary: row.result_summary,
    sessionId: row.session_id,
    createdAt: new Date(row.created_at),
    startedAt: toDate(row.started_at),
    finishedAt: toDate(row.finished_at),
    milestone: row.milestone,
    tags: JSON.parse(row.tags) as string[],
    queuePosition: row.queue_position,
    proposedByAgentId: row.proposed_by_agent_id,
    modelChoice: { model: row.model_choice_model, effort: row.model_choice_effort },
  });
}
