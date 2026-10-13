import type { ModelTokenUsage, RunOutcome } from '@fleet/shared';
import type { TaskRunRepository } from '../../../application/ports/TaskRunRepository.js';
import type { TaskRun } from '../../../domain/task/TaskRun.js';
import type { SqliteDatabase } from './openDatabase.js';

interface TaskRunRow {
  id: string;
  task_id: string;
  started_at: string;
  finished_at: string;
  outcome: RunOutcome;
  error: string | null;
  num_turns: number | null;
  model_usage: string;
}

export class SqliteTaskRunRepository implements TaskRunRepository {
  constructor(private readonly db: SqliteDatabase) {}

  append(run: TaskRun): void {
    this.db
      .prepare(
        `INSERT INTO task_runs (id, task_id, started_at, finished_at, outcome, error, num_turns, model_usage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.taskId,
        run.startedAt.toISOString(),
        run.finishedAt.toISOString(),
        run.outcome,
        run.error,
        run.numTurns,
        JSON.stringify(run.models),
      );
  }

  findByProject(projectId: string): TaskRun[] {
    const rows = this.db
      .prepare(
        `SELECT r.* FROM task_runs r JOIN tasks t ON t.id = r.task_id
         WHERE t.project_id = ? ORDER BY r.finished_at`,
      )
      .all(projectId) as TaskRunRow[];
    return rows.map(toTaskRun);
  }

  findAll(): TaskRun[] {
    return (this.db.prepare('SELECT * FROM task_runs ORDER BY finished_at').all() as TaskRunRow[]).map(
      toTaskRun,
    );
  }
}

function toTaskRun(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: new Date(row.started_at),
    finishedAt: new Date(row.finished_at),
    outcome: row.outcome,
    error: row.error,
    numTurns: row.num_turns,
    models: JSON.parse(row.model_usage) as ModelTokenUsage[],
  };
}
