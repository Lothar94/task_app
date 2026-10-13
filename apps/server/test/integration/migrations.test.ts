import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/infrastructure/persistence/sqlite/migrations.js';
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
