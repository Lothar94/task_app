import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORGANIZATION_NAME } from '@fleet/shared';
import { DEFAULT_ORGANIZATION_ID, migrate } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import { SqliteAgentRepository } from '../../src/infrastructure/persistence/sqlite/SqliteAgentRepository.js';

/** Creates a database file at an old schema version, filled by `seed`. */
function legacyDatabase(version: number, seed: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'fleet-')), 'fleet.db');
  const db = new Database(file);
  migrate(db, version);
  db.exec(seed);
  db.close();
  return file;
}

const AGENT_V1 = `INSERT INTO agents (id, name, role, description, instructions, model, allowed_tools, permission_mode,
  max_turns, created_at, updated_at) VALUES ('a1', 'CTO', 'Lead', '', 'Lead', 'opus', '[]', 'dontAsk', 10,
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`;

describe('database migrations', () => {
  it('gives agents created before effort existed the high level', () => {
    const file = legacyDatabase(1, AGENT_V1);

    const agent = new SqliteAgentRepository(openDatabase(file)).findById('a1');

    expect(agent?.toSnapshot().effort).toBe('high');
  });

  it('numbers existing tasks per project in creation order', () => {
    const file = legacyDatabase(
      2,
      `${AGENT_V1}
      INSERT INTO projects VALUES ('p1', 'P1', '', '/tmp/p1', 'x'), ('p2', 'P2', '', '/tmp/p2', 'x');
      INSERT INTO tasks (id, project_id, agent_id, title, description, status, created_at) VALUES
        ('t-late', 'p1', 'a1', 'Late', 'd', 'completed', '2026-01-03'),
        ('t-early', 'p1', 'a1', 'Early', 'd', 'completed', '2026-01-01'),
        ('t-other', 'p2', 'a1', 'Other', 'd', 'completed', '2026-01-02');`,
    );

    const numbers = openDatabase(file).prepare('SELECT id, number FROM tasks ORDER BY id').all();

    expect(numbers).toEqual([
      { id: 't-early', number: 1 },
      { id: 't-late', number: 2 },
      { id: 't-other', number: 1 },
    ]);
  });
});

describe('task runs migration', () => {
  it('creates one run without token data for every finished task', () => {
    const file = legacyDatabase(
      3,
      `${AGENT_V1}
      INSERT INTO projects VALUES ('p1', 'P1', '', '/tmp/p1', 'x');
      INSERT INTO tasks (id, number, project_id, agent_id, title, description, status, result_summary, created_at,
        started_at, finished_at) VALUES
        ('t1', 1, 'p1', 'a1', 'Done', 'd', 'completed', 'ok', '2026-01-01', '2026-01-01', '2026-01-02'),
        ('t2', 2, 'p1', 'a1', 'Broken', 'd', 'failed', 'boom', '2026-01-01', '2026-01-01', '2026-01-02'),
        ('t3', 3, 'p1', 'a1', 'Running', 'd', 'running', NULL, '2026-01-01', '2026-01-01', NULL);`,
    );

    const runs = openDatabase(file)
      .prepare('SELECT task_id, outcome, error, model_usage FROM task_runs ORDER BY task_id')
      .all();

    expect(runs).toEqual([
      { task_id: 't1', outcome: 'completed', error: null, model_usage: '[]' },
      { task_id: 't2', outcome: 'failed', error: 'boom', model_usage: '[]' },
    ]);
  });
});

describe('task planning migration', () => {
  it('gives existing tasks no milestone, no tags and no queue position', () => {
    const file = legacyDatabase(
      4,
      `${AGENT_V1}
      INSERT INTO projects VALUES ('p1', 'P1', '', '/tmp/p1', 'x');
      INSERT INTO tasks (id, number, project_id, agent_id, title, description, status, created_at)
        VALUES ('t1', 1, 'p1', 'a1', 'Old', 'd', 'completed', '2026-01-01');`,
    );

    const row = openDatabase(file).prepare('SELECT milestone, tags, queue_position FROM tasks').get();

    expect(row).toEqual({ milestone: null, tags: '[]', queue_position: null });
  });
});

describe('organizations migration', () => {
  const LEGACY_FLEET = `${AGENT_V1}
    INSERT INTO agents (id, name, role, description, instructions, model, effort, allowed_tools, permission_mode,
      max_turns, created_at, updated_at) VALUES ('a2', 'Dev', 'Dev', '', 'Dev', 'sonnet', 'low', '["Read"]', 'dontAsk', 5,
      '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');
    INSERT INTO agent_relations VALUES ('a1', 'a2');
    INSERT INTO projects VALUES ('p1', 'P1', 'desc', '/tmp/p1', '2026-01-01T00:00:00Z');
    INSERT INTO project_agents VALUES ('p1', 'a1'), ('p1', 'a2');
    INSERT INTO tasks (id, number, project_id, agent_id, title, description, status, result_summary, created_at,
      started_at, finished_at) VALUES ('t1', 1, 'p1', 'a2', 'Done', 'd', 'completed', 'ok', '2026-01-01', '2026-01-01', '2026-01-02');
    INSERT INTO conversation_messages VALUES ('m1', 't1', 1, '{}', '2026-01-01');
    INSERT INTO task_runs (id, task_id, started_at, finished_at, outcome, model_usage)
      VALUES ('r1', 't1', '2026-01-01', '2026-01-02', 'completed', '[]');`;

  const count = (db: ReturnType<typeof openDatabase>, table: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

  it('moves every existing record into the default organization without losing data', () => {
    const db = openDatabase(legacyDatabase(5, LEGACY_FLEET));

    const [organization] = db.prepare('SELECT id, name FROM organizations').all();
    expect(organization).toEqual({ id: DEFAULT_ORGANIZATION_ID, name: DEFAULT_ORGANIZATION_NAME });
    expect(db.prepare('SELECT DISTINCT organization_id FROM agents').all()).toEqual([
      { organization_id: DEFAULT_ORGANIZATION_ID },
    ]);
    expect(db.prepare('SELECT DISTINCT organization_id FROM projects').all()).toEqual([
      { organization_id: DEFAULT_ORGANIZATION_ID },
    ]);
    for (const [table, rows] of Object.entries({
      agents: 2,
      agent_relations: 1,
      projects: 1,
      project_agents: 2,
      tasks: 1,
      conversation_messages: 1,
      task_runs: 1,
    })) {
      expect(count(db, table), table).toBe(rows);
    }
    expect(new SqliteAgentRepository(db).findById('a2')?.toSnapshot()).toMatchObject({
      name: 'Dev',
      effort: 'low',
      allowedTools: ['Read'],
      organizationId: DEFAULT_ORGANIZATION_ID,
    });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('keeps enforcing foreign keys and cascades afterwards', () => {
    const db = openDatabase(legacyDatabase(5, LEGACY_FLEET));

    expect(() => db.prepare('DELETE FROM agents WHERE id = ?').run('a2')).toThrow(/FOREIGN KEY/);
    db.prepare('DELETE FROM projects WHERE id = ?').run('p1');
    expect(count(db, 'tasks')).toBe(0);
    expect(count(db, 'project_agents')).toBe(0);
  });

  it('allows the same agent name in different organizations but not within one', () => {
    const db = openDatabase(legacyDatabase(5, LEGACY_FLEET));
    db.prepare("INSERT INTO organizations VALUES ('o2', 'Other', 'x', 'x')").run();
    const insert =
      db.prepare(`INSERT INTO agents (id, organization_id, name, role, description, instructions, model,
      effort, allowed_tools, permission_mode, max_turns, created_at, updated_at)
      VALUES (?, ?, ?, 'r', '', 'i', 'opus', 'high', '[]', 'dontAsk', 1, 'x', 'x')`);

    expect(() => insert.run('b1', 'o2', 'cto')).not.toThrow();
    expect(() => insert.run('b2', DEFAULT_ORGANIZATION_ID, 'CTO')).toThrow(/UNIQUE/);
  });

  it('refuses to commit when a foreign key would be left broken', () => {
    const file = legacyDatabase(
      5,
      `${LEGACY_FLEET} PRAGMA foreign_keys = OFF;
      INSERT INTO project_agents VALUES ('p1', 'ghost');`,
    );

    expect(() => openDatabase(file)).toThrow(/foreign key violation/);
    expect(new Database(file).pragma('user_version', { simple: true })).toBe(5);
  });

  it('gives agents created before skills existed an empty skill list', () => {
    const file = legacyDatabase(
      6,
      `INSERT INTO agents (id, organization_id, name, role, description, instructions, model, effort, allowed_tools,
        permission_mode, max_turns, created_at, updated_at) VALUES ('a1', '${DEFAULT_ORGANIZATION_ID}', 'CTO', 'Lead', '',
        'Lead', 'opus', 'high', '["Read"]', 'dontAsk', 10, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
    );

    const agent = new SqliteAgentRepository(openDatabase(file)).findById('a1');

    expect(agent?.skills).toEqual([]);
  });
});
