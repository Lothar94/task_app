import type { AgentDto, AgentExportDto, AgentImportResultDto, ExportedAgent } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../../src/domain/agent/Agent.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import { SqliteAgentRepository } from '../../src/infrastructure/persistence/sqlite/SqliteAgentRepository.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTestFleet, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

const exported = (name: string, collaborators: string[] = [], overrides: Partial<ExportedAgent> = {}): ExportedAgent => ({
  ...profile(name),
  collaborators,
  ...overrides,
});

const fileOf = (...agents: ExportedAgent[]): AgentExportDto => ({
  format: 'agent-fleet/agents',
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  organization: 'Origin',
  agents,
});

describe('agent import', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;

  beforeEach(async () => {
    fleet = createTestFleet();
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
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

  const namesOf = (agents: AgentDto[]) => agents.map((agent) => agent.name);

  it('round-trips an export into another organization', async () => {
    const backend = await createAgent('Backend');
    const cto = await createAgent('CTO', [backend]);
    const file: AgentExportDto = (
      await app.inject({
        method: 'POST',
        url: `/api/organizations/${ORG}/agents/export`,
        payload: { agentIds: [cto], includeCollaborators: true },
      })
    ).json();
    const other = (await app.inject({ method: 'POST', url: '/api/organizations', payload: { name: 'Other' } })).json();

    const response = await importAgents({ file }, other.id);

    expect(response.statusCode).toBe(201);
    const result: AgentImportResultDto = response.json();
    expect(result.skipped).toEqual([]);
    expect(result.renamed).toEqual([]);
    const reExported: AgentExportDto = (
      await app.inject({ method: 'POST', url: `/api/organizations/${other.id}/agents/export`, payload: {} })
    ).json();
    const byName = (agents: ExportedAgent[]) => [...agents].sort((a, b) => a.name.localeCompare(b.name));
    expect(byName(reExported.agents)).toEqual(byName(file.agents));
    const ids = new Set(result.imported.map((agent) => agent.id));
    expect(ids.has(backend)).toBe(false);
    expect(namesOf(await listAgents(other.id)).sort()).toEqual(['Backend', 'CTO']);
  });

  it('links collaborators declared after the agent that uses them', async () => {
    const result: AgentImportResultDto = (await importAgents({ file: fileOf(exported('A', ['B']), exported('B')) })).json();

    const [a, b] = result.imported;
    expect(a?.collaboratorIds).toEqual([b?.id]);
  });

  describe('name conflicts', () => {
    it('fails with 409 and imports nothing by default', async () => {
      await createAgent('Taken');

      const response = await importAgents({ file: fileOf(exported('New'), exported('Taken')) });

      expect(response.statusCode).toBe(409);
      expect(response.json().message ?? response.json().error).toContain('"Taken"');
      expect(namesOf(await listAgents())).toEqual(['Taken']);
    });

    it('skips existing agents and points collaborators at them', async () => {
      const taken = await createAgent('Taken');

      const response = await importAgents({
        file: fileOf(exported('New', ['Taken']), exported('Taken')),
        onConflict: 'skip',
      });

      expect(response.statusCode).toBe(201);
      const result: AgentImportResultDto = response.json();
      expect(result.skipped).toEqual(['Taken']);
      expect(namesOf(result.imported)).toEqual(['New']);
      expect(result.imported[0]?.collaboratorIds).toEqual([taken]);
      expect(await listAgents()).toHaveLength(2);
    });

    it('renames to the first free "Name (n)" and keeps collaborator links', async () => {
      await createAgent('Taken');
      await createAgent('Taken (2)');

      const result: AgentImportResultDto = (
        await importAgents({
          file: fileOf(exported('Boss', ['Taken']), exported('Taken'), exported('Taken (3)')),
          onConflict: 'rename',
        })
      ).json();

      expect(result.renamed).toEqual([{ from: 'Taken', to: 'Taken (4)' }]);
      expect(namesOf(result.imported)).toEqual(['Boss', 'Taken (4)', 'Taken (3)']);
      expect(result.imported[0]?.collaboratorIds).toEqual([result.imported[1]?.id]);
    });

    it('keeps renamed names within the 60 character limit', async () => {
      const long = 'x'.repeat(60);
      await createAgent(long);

      const result: AgentImportResultDto = (
        await importAgents({ file: fileOf(exported(long)), onConflict: 'rename' })
      ).json();

      expect(result.imported[0]?.name).toBe(`${'x'.repeat(56)} (2)`);
    });

    it('ignores agents of other organizations', async () => {
      const other = (await app.inject({ method: 'POST', url: '/api/organizations', payload: { name: 'Other' } })).json();
      await createAgent('Shared', [], other.id);

      const response = await importAgents({ file: fileOf(exported('Shared')) });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('validation', () => {
    it('rejects duplicate names inside the file, after trimming', async () => {
      const response = await importAgents({ file: fileOf(exported('Twin'), exported(' Twin ')) });

      expect(response.statusCode).toBe(400);
      expect(await listAgents()).toHaveLength(0);
    });

    it('rejects unknown collaborators', async () => {
      const response = await importAgents({ file: fileOf(exported('A', ['Ghost'])) });

      expect(response.statusCode).toBe(400);
      expect(await listAgents()).toHaveLength(0);
    });

    it('answers 400, not 409, when unknown collaborators come with a name conflict', async () => {
      await createAgent('A');

      const response = await importAgents({ file: fileOf(exported('A', ['Ghost'])), onConflict: 'fail' });

      expect(response.statusCode).toBe(400);
      expect(await listAgents()).toHaveLength(1);
    });

    it('rejects self references', async () => {
      expect((await importAgents({ file: fileOf(exported('A', ['A'])) })).statusCode).toBe(400);
    });

    it('rejects empty instructions without drafting them', async () => {
      const response = await importAgents({ file: fileOf(exported('A', [], { instructions: '  ' })) });

      expect(response.statusCode).toBe(400);
    });

    it.each([
      ['format', { format: 'other' }],
      ['version', { version: 2 }],
    ])('rejects a wrong %s', async (_field, patch) => {
      expect((await importAgents({ file: { ...fileOf(exported('A')), ...patch } })).statusCode).toBe(400);
    });

    it('rejects an unknown strategy and an empty file', async () => {
      expect((await importAgents({ file: fileOf(exported('A')), onConflict: 'merge' })).statusCode).toBe(400);
      expect((await importAgents({ file: fileOf() })).statusCode).toBe(400);
    });

    it('answers 404 for an unknown organization', async () => {
      expect((await importAgents({ file: fileOf(exported('A')) }, 'missing')).statusCode).toBe(404);
    });

    it('accepts at most 200 agents', async () => {
      const many = (count: number) => fileOf(...Array.from({ length: count }, (_, i) => exported(`Agent ${i}`)));

      expect((await importAgents({ file: many(201) })).statusCode).toBe(400);
      expect((await importAgents({ file: many(200) })).statusCode).toBe(201);
      expect(await listAgents()).toHaveLength(200);
    });
  });

  it('is all or nothing when an agent in the middle is invalid', async () => {
    const response = await importAgents({
      file: fileOf(exported('Good'), exported('Bad', [], { maxTurns: 0 }), exported('Also good')),
    });

    expect(response.statusCode).toBe(400);
    expect(await listAgents()).toHaveLength(0);
  });

  it('rolls back every agent when persisting fails', () => {
    const repository = new SqliteAgentRepository(openDatabase(':memory:'));
    const now = new Date();
    const first = Agent.create('a1', ORG, profile('First'), now);
    const second = Agent.create('a2', ORG, profile('Second'), now);
    second.setCollaborators(['missing-id'], now);

    expect(() => repository.saveAll([first, second])).toThrow();
    expect(repository.findByOrganization(ORG)).toEqual([]);
  });
});
