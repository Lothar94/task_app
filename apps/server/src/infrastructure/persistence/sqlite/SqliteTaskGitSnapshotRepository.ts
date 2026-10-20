import type {
  TaskGitSnapshot,
  TaskGitSnapshotRepository,
} from '../../../application/ports/TaskGitSnapshotRepository.js';
import type { SqliteDatabase } from './openDatabase.js';

interface SnapshotRow {
  task_id: string;
  base_sha: string;
  base_branch: string | null;
  head_sha: string | null;
  head_branch: string | null;
}

export class SqliteTaskGitSnapshotRepository implements TaskGitSnapshotRepository {
  constructor(private readonly db: SqliteDatabase) {}

  find(taskId: string): TaskGitSnapshot | null {
    const row = this.db.prepare('SELECT * FROM task_git_snapshots WHERE task_id = ?').get(taskId) as
      SnapshotRow | undefined;
    return row ? toSnapshot(row) : null;
  }

  save({ taskId, base, head }: TaskGitSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO task_git_snapshots (task_id, base_sha, base_branch, head_sha, head_branch)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(task_id) DO UPDATE SET base_sha = excluded.base_sha, base_branch = excluded.base_branch,
           head_sha = excluded.head_sha, head_branch = excluded.head_branch`,
      )
      .run(taskId, base.sha, base.branch, head?.sha ?? null, head?.branch ?? null);
  }
}

function toSnapshot(row: SnapshotRow): TaskGitSnapshot {
  return {
    taskId: row.task_id,
    base: { sha: row.base_sha, branch: row.base_branch },
    head: row.head_sha ? { sha: row.head_sha, branch: row.head_branch } : null,
  };
}
