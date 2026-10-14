import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTeamProject, createTestFleet, eventually, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;
const CATALOG = [
  { name: 'pdf', description: 'Work with PDFs', plugin: null },
  { name: 'graphify', description: 'Build a graph', plugin: null },
  { name: 'caveman:caveman', description: 'Talk short', plugin: 'caveman' },
];

describe('agent skills', () => {
  let app: FastifyInstance;
  let fleet: ReturnType<typeof createTestFleet>;

  beforeEach(async () => {
    fleet = createTestFleet({}, 4, [], CATALOG);
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });

  afterEach(() => app.close());

  const post = (payload: object) =>
    app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents`, payload });

  it('creates and updates an agent with skills', async () => {
    const created = await post({ ...profile('Lara'), skills: [' graphify ', 'graphify', 'pdf'] });
    expect(created.statusCode).toBe(201);
    expect(created.json().skills).toEqual(['graphify', 'pdf']);

    const { id } = created.json();
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      payload: { ...profile('Lara'), skills: ['pdf'] },
    });
    expect(updated.json().skills).toEqual(['pdf']);
    const fetched = await app.inject({ method: 'GET', url: `/api/agents/${id}` });
    expect(fetched.json().skills).toEqual(['pdf']);
  });

  it('defaults to no skills when the field is missing', async () => {
    const { skills: _skills, ...withoutSkills } = profile('Lara');
    const created = await post(withoutSkills);
    expect(created.json().skills).toEqual([]);

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/agents/${created.json().id}`,
      payload: withoutSkills,
    });
    expect(updated.json().skills).toEqual([]);
  });

  it('answers 400 naming the invalid skill', async () => {
    const response = await post({ ...profile('Lara'), skills: ['Graphify'] });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('"Graphify"');
  });

  it('answers 400 to a skills field that is not a list of strings', async () => {
    expect((await post({ ...profile('Lara'), skills: 'graphify' })).statusCode).toBe(400);
  });

  it('serves the skill catalog', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/skills' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(CATALOG);
  });

  it('round-trips a plugin skill name', async () => {
    const created = await post({ ...profile('Lara'), skills: ['caveman:caveman'] });
    expect(created.statusCode).toBe(201);
    expect(created.json().skills).toEqual(['caveman:caveman']);
  });

  it('answers 400 to a malformed plugin skill name', async () => {
    const response = await post({ ...profile('Lara'), skills: ['a:b:c'] });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('plugin:skill');
  });

  it('passes the skills to the instruction writer when drafting', async () => {
    const created = await post({ ...profile('Lara'), instructions: '', skills: ['pdf'] });
    expect(created.statusCode).toBe(201);
    const draft = await app.inject({
      method: 'POST',
      url: '/api/agents/instructions-draft',
      payload: { name: 'X', role: 'Y' },
    });
    expect(draft.statusCode).toBe(200);
    expect(fleet.instructionWriter.briefs.map((brief) => brief.skills)).toEqual([['pdf'], []]);
  });

  it('sends the skills and the bridge directory in the run request, also on follow-ups', async () => {
    const { project, cto } = await createTeamProject(fleet, []);
    const lara = await fleet.useCases.createAgent.execute({
      organizationId: ORG,
      profile: profile('Lara', { skills: ['graphify'] }),
      collaboratorIds: [],
    });
    fleet.useCases.setProjectMembers.execute(project.id, [cto.id, lara.id]);

    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: lara.id,
      title: 'Go',
      description: 'Go',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
    fleet.useCases.sendFollowUp.execute(task.id, 'more');
    await eventually(() => expect(fleet.runtime.requests).toHaveLength(2));

    for (const request of fleet.runtime.requests) {
      expect(request.skills).toEqual(['graphify']);
      expect(request.skillsDirectory).toBe('/tmp/skill-bridges/graphify');
      expect(request.systemPromptAppendix).toContain('# Your skills');
    }
    expect(fleet.skillWorkspace.prepared).toHaveLength(2);
  });

  it('sends no skills directory for an agent without skills', async () => {
    const { project, cto } = await createTeamProject(fleet, []);
    fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });
    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));
    expect(fleet.runtime.requests[0]).toMatchObject({ skills: [], skillsDirectory: null });
  });
});
