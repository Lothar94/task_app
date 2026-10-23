import type { AgentDto, AgentExportDto, AgentImportResultDto, ExportedAgent } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTestFleet, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

const exported = (name: string, collaborators: string[] = [], overrides: Record<string, unknown> = {}): ExportedAgent =>
  ({ ...profile(name), collaborators, ...overrides }) as ExportedAgent;

const fileOf = (...agents: ExportedAgent[]): AgentExportDto => ({
  format: 'agent-fleet/agents',
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  organization: 'Origin',
  agents,
});

describe('agent import (QA gaps)', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;

  beforeEach(async () => {
    fleet = createTestFleet();
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });

  afterEach(() => app.close());

  const importAgents = (payload: object, organizationId = ORG) =>
    app.inject({ method: 'POST', url: `/api/organizations/${organizationId}/agents/import`, payload });

  const listAgents = async (organizationId = ORG): Promise<AgentDto[]> =>
    (await app.inject({ method: 'GET', url: `/api/organizations/${organizationId}/agents` })).json();

  const createAgent = async (name: string, collaboratorIds: string[] = [], organizationId = ORG) =>
    (await fleet.useCases.createAgent.execute({ organizationId, profile: profile(name), collaboratorIds })).id;

  const exportAll = async (organizationId = ORG): Promise<AgentExportDto> =>
    (await app.inject({ method: 'POST', url: `/api/organizations/${organizationId}/agents/export`, payload: {} })).json();

  it('trims names and collaborator references', async () => {
    const res = await importAgents({ file: fileOf(exported('  Lead  ', ['  Dev ']), exported(' Dev')) });

    expect(res.statusCode).toBe(201);
    const agents = await listAgents();
    const lead = agents.find((a) => a.name === 'Lead');
    const dev = agents.find((a) => a.name === 'Dev');
    expect(lead?.collaboratorIds).toEqual([dev?.id]);
  });

  it('skips to the next free number when "Name (2)" already exists', async () => {
    await createAgent('Ana');
    await createAgent('Ana (2)');

    const res = await importAgents({ file: fileOf(exported('Ana')), onConflict: 'rename' });

    expect(res.statusCode).toBe(201);
    expect((res.json() as AgentImportResultDto).renamed).toEqual([{ from: 'Ana', to: 'Ana (3)' }]);
  });

  it('does not rename onto a name that the file itself carries', async () => {
    await createAgent('Ana');

    const res = await importAgents({ file: fileOf(exported('Ana'), exported('Ana (2)')), onConflict: 'rename' });

    expect((res.json() as AgentImportResultDto).renamed).toEqual([{ from: 'Ana', to: 'Ana (3)' }]);
  });

  it('points collaborators at the existing agent when skipping, leaving it untouched', async () => {
    const existing = await createAgent('Dev');
    const before = (await listAgents()).find((a) => a.id === existing);

    const res = await importAgents({
      file: fileOf(exported('Lead', ['Dev']), exported('Dev', [], { role: 'Changed', instructions: 'Changed' })),
      onConflict: 'skip',
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as AgentImportResultDto;
    expect(body.skipped).toEqual(['Dev']);
    expect(body.imported.map((a) => a.name)).toEqual(['Lead']);
    expect(body.imported[0]?.collaboratorIds).toEqual([existing]);
    expect((await listAgents()).find((a) => a.id === existing)).toEqual(before);
  });

  it('applies defaults when optional fields are omitted', async () => {
    const { effort: _e, permissionMode: _p, skills: _s, ...bare } = exported('Bare');

    const res = await importAgents({ file: fileOf(bare as ExportedAgent) });

    expect(res.statusCode).toBe(201);
    const agent = (res.json() as AgentImportResultDto).imported[0];
    expect(agent?.effort).toBeTruthy();
    expect(agent?.permissionMode).toBeTruthy();
    expect(agent?.skills).toEqual([]);
  });

  it.each([
    ['not an array', 'x'],
    ['holds an invalid name', ['Bad Skill!']],
  ])('answers 400 when skills %s, importing nothing', async (_label, skills) => {
    const res = await importAgents({ file: fileOf(exported('Ok'), exported('Bad', [], { skills })) });

    expect(res.statusCode).toBe(400);
    expect(await listAgents()).toEqual([]);
  });

  it('drops blank and duplicate skills like agent creation does', async () => {
    const res = await importAgents({ file: fileOf(exported('Dup', [], { skills: ['', ' a ', 'a'] })) });

    expect(res.statusCode).toBe(201);
    expect((res.json() as AgentImportResultDto).imported[0]?.skills).toEqual(['a']);
  });

  it('export → import → export keeps the content', async () => {
    const dev = await createAgent('Dev');
    await createAgent('Lead', [dev]);
    const first = await exportAll();
    const other = fleet.useCases.createOrganization.execute('Other').id;

    expect((await importAgents({ file: first }, other)).statusCode).toBe(201);
    const second = await exportAll(other);

    const byName = (dto: AgentExportDto) => [...dto.agents].sort((a, b) => a.name.localeCompare(b.name));
    expect(byName(second)).toEqual(byName(first));
  });
});
