import { DEFAULT_ORGANIZATION_NAME } from '@fleet/shared';
import type Database from 'better-sqlite3';

/** Fixed id of the organization that owns everything created before organizations existed. */
export const DEFAULT_ORGANIZATION_ID = 'default';

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
  `
  CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO organizations (id, name, created_at, updated_at) VALUES
    ('${DEFAULT_ORGANIZATION_ID}', '${DEFAULT_ORGANIZATION_NAME.replaceAll("'", "''")}',
     strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

  -- Agent names stop being globally unique: they are unique within their organization.
  CREATE TABLE agents_rebuilt (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL COLLATE NOCASE,
    role TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    model TEXT NOT NULL,
    effort TEXT NOT NULL,
    allowed_tools TEXT NOT NULL,
    permission_mode TEXT NOT NULL,
    max_turns INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (organization_id, name)
  );
  INSERT INTO agents_rebuilt (id, organization_id, name, role, description, instructions, model, effort,
      allowed_tools, permission_mode, max_turns, created_at, updated_at)
    SELECT id, '${DEFAULT_ORGANIZATION_ID}', name, role, description, instructions, model, effort,
      allowed_tools, permission_mode, max_turns, created_at, updated_at
    FROM agents;
  DROP TABLE agents;
  ALTER TABLE agents_rebuilt RENAME TO agents;

  CREATE TABLE projects_rebuilt (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    workspace_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  INSERT INTO projects_rebuilt (id, organization_id, name, description, workspace_path, created_at)
    SELECT id, '${DEFAULT_ORGANIZATION_ID}', name, description, workspace_path, created_at FROM projects;
  DROP TABLE projects;
  ALTER TABLE projects_rebuilt RENAME TO projects;
  CREATE INDEX projects_organization_idx ON projects(organization_id);
  `,
  `ALTER TABLE agents ADD COLUMN skills TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE projects ADD COLUMN archived_at TEXT;`,
  `ALTER TABLE tasks ADD COLUMN proposed_by_agent_id TEXT REFERENCES agents(id);`,
  `ALTER TABLE task_runs ADD COLUMN llm_ms INTEGER;
   ALTER TABLE task_runs ADD COLUMN tool_ms INTEGER;`,
  `CREATE TABLE task_git_snapshots (
    task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    base_sha TEXT NOT NULL,
    base_branch TEXT,
    head_sha TEXT,
    head_branch TEXT
  );`,
  `ALTER TABLE agents ADD COLUMN model_selection TEXT NOT NULL DEFAULT 'fixed';`,
  `ALTER TABLE tasks ADD COLUMN model_choice_model TEXT;
   ALTER TABLE tasks ADD COLUMN model_choice_effort TEXT;`,
  `ALTER TABLE agents ADD COLUMN temperature REAL;
   ALTER TABLE agents ADD COLUMN max_output_tokens INTEGER;
   ALTER TABLE agents ADD COLUMN mcp_servers TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE agents ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;`,
];

/** Migrations (by version) that rebuild tables referenced by foreign keys, so they run with FKs disabled. */
const REBUILDING_MIGRATIONS: ReadonlySet<number> = new Set([6]);

/** Applies pending migrations, optionally stopping at `targetVersion` (useful to build old schemas in tests). */
export function migrate(db: Database.Database, targetVersion = MIGRATIONS.length): void {
  const applied = db.pragma('user_version', { simple: true }) as number;
  MIGRATIONS.slice(applied, targetVersion).forEach((sql, offset) => {
    const version = applied + offset + 1;
    if (REBUILDING_MIGRATIONS.has(version)) applyWithoutForeignKeys(db, sql, version);
    else applyInTransaction(db, sql, version);
  });
}

function applyInTransaction(db: Database.Database, sql: string, version: number): void {
  db.transaction(() => {
    db.exec(sql);
    db.pragma(`user_version = ${version}`);
  })();
}

/**
 * PRAGMA foreign_keys is a no-op inside a transaction, so it is switched off around it. Nothing is
 * committed unless every foreign key still holds afterwards.
 */
function applyWithoutForeignKeys(db: Database.Database, sql: string, version: number): void {
  const wereEnabled = db.pragma('foreign_keys', { simple: true }) === 1;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(sql);
      const violations = db.pragma('foreign_key_check') as unknown[];
      if (violations.length > 0) {
        throw new Error(`Migration ${version} leaves ${violations.length} foreign key violation(s)`);
      }
      db.pragma(`user_version = ${version}`);
    })();
  } finally {
    if (wereEnabled) db.pragma('foreign_keys = ON');
  }
}
