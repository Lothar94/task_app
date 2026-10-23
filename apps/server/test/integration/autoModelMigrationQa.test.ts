import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';

/** Last schema version before auto model selection (whose migrations are versions 12 and 13). */
const PRE_FEATURE_VERSION = 11;

/** Builds a database at the schema that existed before auto model selection. */
function legacyFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'fleet-auto-')), 'fleet.db');
  const db = new Database(file);
  migrate(db, PRE_FEATURE_VERSION);
  db.close();
  return file;
}

describe('auto model selection migration', () => {
  it('adds the columns with fixed / null defaults and keeps existing rows', () => {
    const file = legacyFile();
    const raw = new Database(file);
    const before = raw.pragma('user_version', { simple: true }) as number;
    raw.exec(`INSERT INTO agents (id, organization_id, name, role, description, instructions, model, effort, allowed_tools,
      permission_mode, max_turns, created_at, updated_at) SELECT 'a1', id, 'CTO', 'Lead', '', 'Lead', 'opus', 'high', '[]',
      'dontAsk', 10, '2026-01-01', '2026-01-01' FROM organizations LIMIT 1;`);
    raw.close();

    const db = openDatabase(file);

    expect(db.pragma('user_version', { simple: true })).toBeGreaterThan(before);
    expect(db.prepare('SELECT model_selection FROM agents WHERE id = ?').get('a1')).toEqual({ model_selection: 'fixed' });
    const taskColumns = (db.pragma('table_info(tasks)') as { name: string }[]).map((c) => c.name);
    expect(taskColumns).toEqual(expect.arrayContaining(['model_choice_model', 'model_choice_effort']));
    db.close();
  });

  it('is idempotent when opened twice', () => {
    const file = legacyFile();
    openDatabase(file).close();
    const again = openDatabase(file);
    expect(again.prepare('SELECT COUNT(*) AS n FROM agents').get()).toEqual({ n: 0 });
    again.close();
  });
});
