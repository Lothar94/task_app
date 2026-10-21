import { AGENT_EXPORT_FORMAT, AGENT_EXPORT_VERSION, MAX_IMPORTED_AGENTS } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { findNameConflicts, parseImportFile, readImportFile } from './agentImport';

const bundle = (overrides: Record<string, unknown> = {}) => ({
  format: AGENT_EXPORT_FORMAT,
  version: AGENT_EXPORT_VERSION,
  exportedAt: '2026-01-01T00:00:00.000Z',
  organization: 'Acme',
  agents: [{ name: 'Ana', collaborators: [] }],
  ...overrides,
});
const parse = (value: unknown) => parseImportFile(JSON.stringify(value));
const errorOf = (value: unknown) => {
  const result = parse(value);
  return result.ok ? null : result.error;
};

describe('parseImportFile', () => {
  it('accepts a valid export', () => {
    const result = parse(bundle());
    expect(result.ok && result.file.organization).toBe('Acme');
  });

  it('rejects invalid JSON', () => {
    expect(parseImportFile('{no')).toEqual({ ok: false, error: 'El fichero no es un JSON válido.' });
  });

  it('rejects other JSON documents', () => {
    expect(errorOf(bundle({ format: 'otro' }))).toMatch(/no es una exportación/);
    expect(errorOf([1])).toMatch(/no es una exportación/);
    expect(errorOf(null)).toMatch(/no es una exportación/);
  });

  it('rejects unsupported versions', () => {
    expect(errorOf(bundle({ version: 99 }))).toMatch(/Versión/);
  });

  it('rejects empty or missing agents', () => {
    expect(errorOf(bundle({ agents: [] }))).toMatch(/no contiene agentes/);
    expect(errorOf(bundle({ agents: 'x' }))).toMatch(/no contiene agentes/);
  });

  it('rejects more agents than the limit', () => {
    const agents = Array.from({ length: MAX_IMPORTED_AGENTS + 1 }, (_, i) => ({ name: `A${i}` }));
    expect(errorOf(bundle({ agents }))).toMatch(/demasiados/);
  });

  it('rejects agents without a string name', () => {
    expect(errorOf(bundle({ agents: [{ name: 'Ok' }, { name: 3 }] }))).toMatch(/nº 2/);
    expect(errorOf(bundle({ agents: ['x'] }))).toMatch(/nº 1/);
  });
});

describe('findNameConflicts', () => {
  const file = (names: string[]) => {
    const result = parse(bundle({ agents: names.map((name) => ({ name })) }));
    if (!result.ok) throw new Error(result.error);
    return result.file;
  };

  it('returns names that exist, comparing exactly after trimming', () => {
    expect(findNameConflicts(file(['Ana', ' Luis ', 'ana']), ['Ana ', 'Luis'])).toEqual(['Ana', ' Luis ']);
  });

  it('returns nothing without overlap', () => {
    expect(findNameConflicts(file(['Ana']), ['Luis'])).toEqual([]);
  });
});

describe('readImportFile', () => {
  it('parses the file contents', async () => {
    const file = new File([JSON.stringify(bundle())], 'a.json');
    expect(await readImportFile(file)).toMatchObject({ ok: true });
  });

  it('returns a readable error when the file cannot be read', async () => {
    const file = new File(['x'], 'a.json');
    file.text = () => Promise.reject(new Error('boom'));
    expect(await readImportFile(file)).toEqual({
      ok: false,
      error: 'No se pudo leer el fichero. Inténtalo de nuevo.',
    });
  });
});

describe('parseImportFile model selection', () => {
  const file = (agent: object) =>
    JSON.stringify({ format: AGENT_EXPORT_FORMAT, version: AGENT_EXPORT_VERSION, agents: [agent] });
  const modes = (text: string) => {
    const parsed = parseImportFile(text);
    return parsed.ok ? parsed.file.agents.map((agent) => agent.modelSelection) : parsed.error;
  };

  it('treats a missing or unknown mode as fixed', () => {
    expect(modes(file({ name: 'A' }))).toEqual(['fixed']);
    expect(modes(file({ name: 'A', modelSelection: 'weird' }))).toEqual(['fixed']);
  });

  it('keeps the auto mode', () => {
    expect(modes(file({ name: 'A', modelSelection: 'auto' }))).toEqual(['auto']);
  });
});
