import { describe, expect, it } from 'vitest';
import {
  AGENT_EXPORT_FORMAT,
  AGENT_EXPORT_VERSION,
  type AgentExportDto,
  type ExportedAgent,
} from '@fleet/shared';
import { exportFileName, slugify } from './agentExport';

const agent = (name: string) => ({ name, collaborators: [] }) as unknown as ExportedAgent;
const bundle = (organization: string, names: string[]): AgentExportDto => ({
  format: AGENT_EXPORT_FORMAT,
  version: AGENT_EXPORT_VERSION,
  exportedAt: '2026-03-09T10:20:30.000Z',
  organization,
  agents: names.map(agent),
});

describe('slugify', () => {
  it('lowercases, strips accents and collapses non-alphanumerics', () => {
    expect(slugify('  Ingeniería Frontend (Ñandú)! ')).toBe('ingenieria-frontend-nandu');
  });

  it('returns an empty string when nothing alphanumeric remains', () => {
    expect(slugify('¡¿?!')).toBe('');
  });
});

describe('exportFileName', () => {
  it('uses the agent slug for a single agent', () => {
    expect(exportFileName(bundle('Acme', ['Revisora de Código']))).toBe('revisora-de-codigo.json');
  });

  it('uses organization slug and date for several agents', () => {
    expect(exportFileName(bundle('Acme Ñ Corp', ['a', 'b']))).toBe('agents-acme-n-corp-2026-03-09.json');
  });

  it('uses the organization form for an empty bundle', () => {
    expect(exportFileName(bundle('Acme', []))).toBe('agents-acme-2026-03-09.json');
  });

  it('falls back to the organization form when the agent name has no slug', () => {
    expect(exportFileName(bundle('Acme', ['???']))).toBe('agents-acme-2026-03-09.json');
  });
});
