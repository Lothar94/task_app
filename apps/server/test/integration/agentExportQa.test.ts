import type { AgentExportDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTestFleet, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

describe('agent export (QA gaps)', () => {
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

  const createAgent = async (name: string, collaboratorIds: string[] = [], organizationId = ORG, overrides = {}) =>
    (await fleet.useCases.createAgent.execute({ organizationId, profile: profile(name, overrides), collaboratorIds })).id;

  const exportAgents = (payload?: unknown, organizationId = ORG) =>
    app.inject({ method: 'POST', url: `/api/organizations/${organizationId}/agents/export`, payload: payload as object });

  it.each([
    ['agentIds is a string', { agentIds: 'x' }],
    ['agentIds holds non-strings', { agentIds: [1] }],
    ['agentIds holds an empty string', { agentIds: [''] }],
    ['includeCollaborators is a string', { includeCollaborators: 'yes' }],
    ['includeCollaborators is a number', { includeCollaborators: 1 }],
  ])('answers 400 when %s', async (_label, body) => {
    expect((await exportAgents(body)).statusCode).toBe(400);
  });

  it('skips collaborators deleted after linking', async () => {
    const gone = await createAgent('Gone');
    const keep = await createAgent('Keep');
    const lead = await createAgent('Lead', [gone, keep]);
    await fleet.useCases.deleteAgent.execute(gone);

    const dto: AgentExportDto = (await exportAgents({ agentIds: [lead], includeCollaborators: true })).json();

    expect(dto.agents.map((a) => a.name)).toEqual(['Lead', 'Keep']);
    expect(dto.agents[0]?.collaborators).toEqual(['Keep']);
  });

  it('never leaks agents of other organizations', async () => {
    await createAgent('Mine');
    const other = fleet.useCases.createOrganization.execute('Other').id;
    await createAgent('Theirs', [], other);

    const mine: AgentExportDto = (await exportAgents({})).json();
    const theirs: AgentExportDto = (await exportAgents({}, other)).json();

    expect(mine.agents.map((a) => a.name)).toEqual(['Mine']);
    expect(theirs.agents.map((a) => a.name)).toEqual(['Theirs']);
    expect(theirs.organization).toBe('Other');
  });

  it('preserves the full profile including plugin skills', async () => {
    const overrides = {
      skills: ['plugin-x:review', 'local-skill'],
      allowedTools: ['Read', 'Bash', 'Grep'],
      effort: 'low' as const,
      permissionMode: 'acceptEdits' as const,
      maxTurns: 42,
      description: 'desc',
    };
    const id = await createAgent('Full', [], ORG, overrides);

    const dto: AgentExportDto = (await exportAgents({ agentIds: [id] })).json();

    expect(dto.agents[0]).toEqual({ ...profile('Full', overrides), collaborators: [] });
  });

  it('falls back to a safe filename when the slug is empty', async () => {
    const id = await createAgent('日本語');
    const response = await exportAgents({ agentIds: [id] });
    expect(response.headers['content-disposition']).toBe('attachment; filename="agents.json"');
  });

  it('does not let quotes or newlines into the header', async () => {
    const id = await createAgent('a"b\r\nX: y');
    const header = String((await exportAgents({ agentIds: [id] })).headers['content-disposition']);
    expect(header).toBe('attachment; filename="a-b-x-y.json"');
  });
});
