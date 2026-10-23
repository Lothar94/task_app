import type { AgentExportDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTestFleet, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

describe('agent export', () => {
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

  const createAgent = async (name: string, collaboratorIds: string[] = [], organizationId = ORG) =>
    (await fleet.useCases.createAgent.execute({ organizationId, profile: profile(name), collaboratorIds })).id;

  const exportAgents = (payload?: object, organizationId = ORG) =>
    app.inject({ method: 'POST', url: `/api/organizations/${organizationId}/agents/export`, payload });

  const namesOf = (dto: AgentExportDto) => dto.agents.map((agent) => agent.name);

  it('exports a single agent with its full profile', async () => {
    const id = await createAgent('Lara Backend');
    const response = await exportAgents({ agentIds: [id] });

    expect(response.statusCode).toBe(200);
    const dto: AgentExportDto = response.json();
    expect(dto).toMatchObject({ format: 'agent-fleet/agents', version: 1 });
    expect(Number.isNaN(Date.parse(dto.exportedAt))).toBe(false);
    expect(dto.agents).toEqual([{ ...profile('Lara Backend'), collaborators: [] }]);
  });

  it('keeps only collaborators that are part of the export', async () => {
    const backend = await createAgent('Backend');
    const frontend = await createAgent('Frontend');
    const cto = await createAgent('CTO', [backend, frontend]);

    const dto: AgentExportDto = (await exportAgents({ agentIds: [cto, backend] })).json();

    expect(namesOf(dto)).toEqual(['CTO', 'Backend']);
    expect(dto.agents[0]?.collaborators).toEqual(['Backend']);
  });

  it('adds collaborators transitively and survives cycles', async () => {
    const c = await createAgent('C');
    const b = await createAgent('B', [c]);
    const a = await createAgent('A', [b]);
    await fleet.useCases.setAgentCollaborators.execute(c, [a]);
    await createAgent('Unrelated');

    const dto: AgentExportDto = (await exportAgents({ agentIds: [a], includeCollaborators: true })).json();

    expect(namesOf(dto)).toEqual(['A', 'B', 'C']);
    expect(dto.agents.map((agent) => agent.collaborators)).toEqual([['B'], ['C'], ['A']]);
  });

  it('dedupes requested ids and keeps the requested order', async () => {
    const a = await createAgent('A');
    const b = await createAgent('B');
    const dto: AgentExportDto = (await exportAgents({ agentIds: [b, a, b] })).json();
    expect(namesOf(dto)).toEqual(['B', 'A']);
  });

  it('exports every agent when the body is empty or absent', async () => {
    await createAgent('A');
    await createAgent('B');

    const absent: AgentExportDto = (await exportAgents()).json();
    const empty: AgentExportDto = (await exportAgents({})).json();

    expect(namesOf(absent).sort()).toEqual(['A', 'B']);
    expect(empty.agents).toEqual(absent.agents);
  });

  it('rejects an empty selection', async () => {
    const response = await exportAgents({ agentIds: [] });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Select at least one agent to export');
  });

  it('answers 404 for an unknown agent or organization', async () => {
    expect((await exportAgents({ agentIds: ['nope'] })).statusCode).toBe(404);
    expect((await exportAgents({}, 'missing-org')).statusCode).toBe(404);
  });

  it('answers 400 for an agent of another organization', async () => {
    const other = fleet.useCases.createOrganization.execute('Other').id;
    const foreign = await createAgent('Foreign', [], other);
    expect((await exportAgents({ agentIds: [foreign] })).statusCode).toBe(400);
  });

  it('contains no ids or timestamps', async () => {
    const a = await createAgent('A');
    await createAgent('B', [a]);
    const body = (await exportAgents({ includeCollaborators: true })).body;

    expect(body).not.toContain(a);
    expect(body).not.toContain(ORG);
    expect(body).not.toMatch(/"(id|organizationId|collaboratorIds|createdAt|updatedAt)"/);
  });

  describe('Content-Disposition', () => {
    it('uses the agent slug for a single agent', async () => {
      const id = await createAgent('Lara Backend Ñandú');
      const response = await exportAgents({ agentIds: [id] });
      expect(response.headers['content-disposition']).toBe('attachment; filename="lara-backend-nandu.json"');
    });

    it('uses the organization slug for several agents', async () => {
      await createAgent('A');
      await createAgent('B');
      const org = fleet.useCases.createOrganization.execute('Acme Corp!').id;
      await createAgent('X', [], org);
      await createAgent('Y', [], org);

      const response = await exportAgents({}, org);
      expect(response.headers['content-disposition']).toBe('attachment; filename="agents-acme-corp.json"');
    });
  });
});
