import { AGENT_EXPORT_FORMAT, AGENT_EXPORT_VERSION, type AgentDto, type McpServerDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTestFleet, eventually, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;
const CATALOG: McpServerDto[] = [
  { name: 'github', transport: 'stdio' },
  { name: 'docs', transport: 'http' },
];

describe('agent sheet settings over HTTP', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;

  beforeEach(async () => {
    fleet = createTestFleet({}, 4, [], [], { mcpServerCatalog: { list: async () => CATALOG } });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });
  afterEach(() => app.close());

  const createAgent = (payload: object) =>
    app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents`, payload });
  const updateAgent = (id: string, payload: object) =>
    app.inject({ method: 'PUT', url: `/api/agents/${id}`, payload });

  it('describes the runtime: supported settings and the MCP catalog', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agent-runtime' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      supports: { temperature: false, maxOutputTokens: true },
      mcpServers: CATALOG,
    });
  });

  it('persists the output cap and the MCP servers, normalised', async () => {
    const created = await createAgent({
      ...profile('Dev'),
      maxOutputTokens: 4096,
      mcpServers: [' github ', 'github'],
    });
    expect(created.statusCode).toBe(201);
    const dto: AgentDto = created.json();
    expect(dto).toMatchObject({
      temperature: null,
      maxOutputTokens: 4096,
      mcpServers: ['github'],
      enabled: true,
    });

    const fetched = await app.inject({ method: 'GET', url: `/api/agents/${dto.id}` });
    expect(fetched.json()).toMatchObject({ maxOutputTokens: 4096, mcpServers: ['github'] });
  });

  it('defaults the settings older clients omit, also on update', async () => {
    const { temperature: _t, maxOutputTokens: _m, mcpServers: _s, ...legacy } = profile('Dev');
    const dto: AgentDto = (
      await createAgent({ ...legacy, maxOutputTokens: 100, mcpServers: ['docs'] })
    ).json();

    const updated = await updateAgent(dto.id, legacy);

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ temperature: null, maxOutputTokens: null, mcpServers: [] });
  });

  it.each([
    { maxOutputTokens: 0 },
    { maxOutputTokens: 128_001 },
    { maxOutputTokens: 1.5 },
    { maxOutputTokens: '100' },
    { mcpServers: ['bad name'] },
    { mcpServers: 'github' },
  ])('rejects %j with 400', async (settings) => {
    const response = await createAgent({ ...profile('Dev'), ...settings });
    expect(response.statusCode).toBe(400);
  });

  it('rejects an out-of-range temperature even where the runtime supports it', async () => {
    fleet.runtime.supports.temperature = true;
    expect((await createAgent({ ...profile('Dev'), temperature: 1.5 })).statusCode).toBe(400);
    expect((await createAgent({ ...profile('Dev'), temperature: -0.1 })).statusCode).toBe(400);
  });

  it('rejects a temperature the runtime does not support, on create and update', async () => {
    const rejected = await createAgent({ ...profile('Dev'), temperature: 0.5 });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().error).toMatch(/temperature is not supported/);

    const dto: AgentDto = (await createAgent(profile('Dev'))).json();
    expect((await updateAgent(dto.id, { ...profile('Dev'), temperature: 0.5 })).statusCode).toBe(400);
    expect((await updateAgent(dto.id, { ...profile('Dev'), temperature: null })).statusCode).toBe(200);
  });

  it('accepts the temperature once the runtime supports it', async () => {
    fleet.runtime.supports.temperature = true;
    const created = await createAgent({ ...profile('Dev'), temperature: 0.5 });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ temperature: 0.5 });
  });

  it('rejects an output cap when the runtime cannot apply it', async () => {
    fleet.runtime.supports.maxOutputTokens = false;
    expect((await createAgent({ ...profile('Dev'), maxOutputTokens: 100 })).statusCode).toBe(400);
    expect((await createAgent({ ...profile('Dev'), maxOutputTokens: null })).statusCode).toBe(201);
  });

  it('exports the settings and imports them back as enabled agents', async () => {
    const dto: AgentDto = (
      await createAgent({ ...profile('Dev'), maxOutputTokens: 2048, mcpServers: ['docs'] })
    ).json();
    await app.inject({ method: 'PUT', url: `/api/agents/${dto.id}/enabled`, payload: { enabled: false } });

    const file = (
      await app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents/export`, payload: {} })
    ).json();
    expect(file.agents[0]).toMatchObject({ temperature: null, maxOutputTokens: 2048, mcpServers: ['docs'] });
    expect(file.agents[0]).not.toHaveProperty('enabled');

    const imported = await app.inject({
      method: 'POST',
      url: `/api/organizations/${ORG}/agents/import`,
      payload: { file, onConflict: 'rename' },
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json().imported[0]).toMatchObject({
      name: 'Dev (2)',
      maxOutputTokens: 2048,
      mcpServers: ['docs'],
      enabled: true,
    });
  });

  it('imports older files without the settings and rejects unsupported ones as a whole', async () => {
    const { temperature: _t, maxOutputTokens: _m, mcpServers: _s, ...legacy } = profile('Old');
    const fileWith = (agents: object[]) => ({
      format: AGENT_EXPORT_FORMAT,
      version: AGENT_EXPORT_VERSION,
      agents,
    });
    const importFile = (agents: object[]) =>
      app.inject({
        method: 'POST',
        url: `/api/organizations/${ORG}/agents/import`,
        payload: { file: fileWith(agents) },
      });

    const rejected = await importFile([legacy, { ...profile('Hot'), temperature: 0.9 }]);
    expect(rejected.statusCode).toBe(400);
    expect(fleet.useCases.listAgents.execute(ORG)).toEqual([]);

    const imported = await importFile([legacy]);
    expect(imported.json().imported[0]).toMatchObject({
      temperature: null,
      maxOutputTokens: null,
      mcpServers: [],
    });
  });

  it('hands the output cap and the MCP servers to each run', async () => {
    const dto: AgentDto = (
      await createAgent({ ...profile('Dev'), maxOutputTokens: 4096, mcpServers: ['github'] })
    ).json();
    const project = fleet.useCases.createProject.execute({
      organizationId: ORG,
      details: { name: 'P', description: '', workspacePath: '/tmp/fleet-test-workspace' },
      memberIds: [dto.id],
    });

    fleet.useCases.assignTask.execute(project.id, {
      agentId: dto.id,
      title: 'T',
      description: 'D',
      start: 'now',
    });

    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));
    expect(fleet.runtime.requests[0]).toMatchObject({ maxOutputTokens: 4096, mcpServers: ['github'] });
  });
});
