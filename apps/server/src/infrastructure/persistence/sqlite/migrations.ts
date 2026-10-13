import type Database from 'better-sqlite3';

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    model TEXT NOT NULL,
    allowed_tools TEXT NOT NULL,
    permission_mode TEXT NOT NULL,
    max_turns INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE agent_relations (
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    collaborator_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, collaborator_id)
  );
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    workspace_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE project_agents (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, agent_id)
  );
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    result_summary TEXT,
    session_id TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX tasks_project_idx ON tasks(project_id);
  CREATE INDEX tasks_parent_idx ON tasks(parent_task_id);
  CREATE TABLE conversation_messages (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (task_id, seq)
  );
  `,
  `ALTER TABLE agents ADD COLUMN effort TEXT NOT NULL DEFAULT 'high';`,
  `
  ALTER TABLE tasks ADD COLUMN number INTEGER NOT NULL DEFAULT 0;
  UPDATE tasks SET number = (
    SELECT position FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS position FROM tasks
    ) AS numbered WHERE numbered.id = tasks.id
  );
  CREATE UNIQUE INDEX tasks_project_number_idx ON tasks(project_id, number);
  `,
  `
  CREATE TABLE task_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    outcome TEXT NOT NULL,
    error TEXT,
    num_turns INTEGER,
    model_usage TEXT NOT NULL
  );
  CREATE INDEX task_runs_task_idx ON task_runs(task_id);
  -- Tasks finished before runs were recorded count as one run without token data.
  INSERT INTO task_runs (id, task_id, started_at, finished_at, outcome, error, num_turns, model_usage)
    SELECT 'legacy-' || id, id, COALESCE(started_at, created_at), finished_at, status,
      CASE WHEN status = 'failed' THEN result_summary END, NULL, '[]'
    FROM tasks WHERE status IN ('completed', 'failed', 'cancelled') AND finished_at IS NOT NULL;
  `,
  `
  ALTER TABLE tasks ADD COLUMN milestone TEXT;
  ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE tasks ADD COLUMN queue_position INTEGER;
  CREATE INDEX tasks_queue_idx ON tasks(project_id, queue_position) WHERE status = 'queued';
  `,
];

/** Applies pending migrations, optionally stopping at `targetVersion` (useful to build old schemas in tests). */
export function migrate(db: Database.Database, targetVersion = MIGRATIONS.length): void {
  const applied = db.pragma('user_version', { simple: true }) as number;
  MIGRATIONS.slice(applied, targetVersion).forEach((sql, offset) => {
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${applied + offset + 1}`);
    })();
  });
}
