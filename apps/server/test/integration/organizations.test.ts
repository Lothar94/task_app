import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ORGANIZATION_NAME } from '@fleet/shared';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { createTestFleet, profile } from '../support/testFleet.js';

describe('organizations API', () => {
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

  const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object | undefined });

  const createOrganization = async (name: string): Promise<string> =>
    (await call('POST', '/api/organizations', { name })).json().id;

  const createAgent = (orgId: string, name: string, collaboratorIds: string[] = []) =>
    call('POST', `/api/organizations/${orgId}/agents`, { ...profile(name), collaboratorIds });

  const createProject = (orgId: string, memberIds: string[] = [], name = 'Demo') =>
    call('POST', `/api/organizations/${orgId}/projects`, {
      name,
      workspacePath: '/tmp/fleet-test-workspace',
      memberIds,
    });

  describe('CRUD', () => {
    it('starts with the default organization', async () => {
      const list = await call('GET', '/api/organizations');

      expect(list.json()).toMatchObject([{ id: DEFAULT_ORGANIZATION_ID, name: DEFAULT_ORGANIZATION_NAME }]);
    });

    it('creates organizations, trimming the name, and lists them oldest first', async () => {
      const created = await call('POST', '/api/organizations', { name: '  Acme  ' });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ name: 'Acme' });
      const names = (await call('GET', '/api/organizations')).json().map((org: { name: string }) => org.name);
      expect(names).toEqual([DEFAULT_ORGANIZATION_NAME, 'Acme']);
    });

    it('gets an organization and answers 404 for unknown ones', async () => {
      const id = await createOrganization('Acme');

      expect((await call('GET', `/api/organizations/${id}`)).json()).toMatchObject({ id, name: 'Acme' });
      expect((await call('GET', '/api/organizations/nope')).statusCode).toBe(404);
    });

    it('rejects invalid names with 400 and duplicates (any case) with 409', async () => {
      await createOrganization('Acme');

      expect((await call('POST', '/api/organizations', { name: '   ' })).statusCode).toBe(400);
      expect((await call('POST', '/api/organizations', { name: 'x'.repeat(121) })).statusCode).toBe(400);
      expect((await call('POST', '/api/organizations', {})).statusCode).toBe(400);
      expect((await call('POST', '/api/organizations', { name: 'ACME' })).statusCode).toBe(409);
      expect(
        (await call('POST', '/api/organizations', { name: DEFAULT_ORGANIZATION_NAME.toUpperCase() }))
          .statusCode,
      ).toBe(409);
    });

    it('renames an organization and refreshes updatedAt', async () => {
      const id = await createOrganization('Acme');
      const before = (await call('GET', `/api/organizations/${id}`)).json();
      await new Promise((resolve) => setTimeout(resolve, 5));

      const renamed = await call('PUT', `/api/organizations/${id}`, { name: ' Globex ' });

      expect(renamed.statusCode).toBe(200);
      expect(renamed.json()).toMatchObject({ id, name: 'Globex', createdAt: before.createdAt });
      expect(renamed.json().updatedAt > before.updatedAt).toBe(true);
    });

    it('allows renaming to the same name in another case, but not to another organization name', async () => {
      const id = await createOrganization('Acme');
      await createOrganization('Globex');

      expect((await call('PUT', `/api/organizations/${id}`, { name: 'ACME' })).json()).toMatchObject({
        name: 'ACME',
      });
      expect((await call('PUT', `/api/organizations/${id}`, { name: 'globex' })).statusCode).toBe(409);
      expect((await call('PUT', `/api/organizations/${id}`, { name: '' })).statusCode).toBe(400);
      expect((await call('PUT', '/api/organizations/nope', { name: 'Z' })).statusCode).toBe(404);
    });
  });

  describe('isolation', () => {
    it('lists agents and projects per organization only', async () => {
      const acme = await createOrganization('Acme');
      const agent = (await createAgent(DEFAULT_ORGANIZATION_ID, 'Conde')).json();
      await createProject(DEFAULT_ORGANIZATION_ID, [agent.id], 'Lab project');
      await createAgent(acme, 'Zed');

      const defaultAgents = (
        await call('GET', `/api/organizations/${DEFAULT_ORGANIZATION_ID}/agents`)
      ).json();
      const acmeAgents = (await call('GET', `/api/organizations/${acme}/agents`)).json();
      const acmeProjects = (await call('GET', `/api/organizations/${acme}/projects`)).json();
      const defaultProjects = (
        await call('GET', `/api/organizations/${DEFAULT_ORGANIZATION_ID}/projects`)
      ).json();

      expect(defaultAgents).toMatchObject([{ name: 'Conde', organizationId: DEFAULT_ORGANIZATION_ID }]);
      expect(acmeAgents).toMatchObject([{ name: 'Zed', organizationId: acme }]);
      expect(acmeProjects).toEqual([]);
      expect(defaultProjects).toMatchObject([
        { name: 'Lab project', organizationId: DEFAULT_ORGANIZATION_ID },
      ]);
    });

    it('answers 404 when the organization does not exist', async () => {
      expect((await call('GET', '/api/organizations/nope/agents')).statusCode).toBe(404);
      expect((await call('GET', '/api/organizations/nope/projects')).statusCode).toBe(404);
      expect((await createAgent('nope', 'Conde')).statusCode).toBe(404);
      expect((await createProject('nope')).statusCode).toBe(404);
      expect((await call('GET', '/api/organizations/nope/dashboard')).statusCode).toBe(404);
    });

    it('no longer serves the global agent, project and dashboard collections', async () => {
      expect((await call('GET', '/api/agents')).statusCode).toBe(404);
      expect((await call('POST', '/api/agents', profile('X'))).statusCode).toBe(404);
      expect((await call('GET', '/api/projects')).statusCode).toBe(404);
      expect((await call('POST', '/api/projects', {})).statusCode).toBe(404);
      expect((await call('GET', '/api/dashboard')).statusCode).toBe(404);
    });
  });

  describe('business rules', () => {
    it('allows the same agent name in different organizations but not within one', async () => {
      const acme = await createOrganization('Acme');

      expect((await createAgent(DEFAULT_ORGANIZATION_ID, 'Conde')).statusCode).toBe(201);
      expect((await createAgent(acme, 'conde')).statusCode).toBe(201);
      expect((await createAgent(acme, 'CONDE')).statusCode).toBe(409);
    });

    it('renaming an agent only conflicts with agents of its own organization', async () => {
      const acme = await createOrganization('Acme');
      await createAgent(DEFAULT_ORGANIZATION_ID, 'Conde');
      const zed = (await createAgent(acme, 'Zed')).json();

      const renamed = await call('PUT', `/api/agents/${zed.id}`, { ...profile('Conde'), maxTurns: 10 });

      expect(renamed.statusCode).toBe(200);
    });

    it('rejects collaborators from another organization when creating and updating an agent', async () => {
      const acme = await createOrganization('Acme');
      const outsider = (await createAgent(acme, 'Outsider')).json();
      const local = (await createAgent(DEFAULT_ORGANIZATION_ID, 'Local')).json();

      expect((await createAgent(DEFAULT_ORGANIZATION_ID, 'CTO', [outsider.id])).statusCode).toBe(400);
      const update = await call('PUT', `/api/agents/${local.id}/collaborators`, {
        collaboratorIds: [outsider.id],
      });
      expect(update.statusCode).toBe(400);
      expect((await call('GET', `/api/agents/${local.id}`)).json().collaboratorIds).toEqual([]);
    });

    it('rejects project members from another organization when creating and updating a project', async () => {
      const acme = await createOrganization('Acme');
      const outsider = (await createAgent(acme, 'Outsider')).json();
      const project = (await createProject(DEFAULT_ORGANIZATION_ID)).json();

      expect((await createProject(DEFAULT_ORGANIZATION_ID, [outsider.id], 'Other')).statusCode).toBe(400);
      const update = await call('PUT', `/api/projects/${project.id}/agents`, { memberIds: [outsider.id] });
      expect(update.statusCode).toBe(400);
    });

    it('accepts collaborators and members of the same organization', async () => {
      const acme = await createOrganization('Acme');
      const a = (await createAgent(acme, 'A')).json();
      const b = (await createAgent(acme, 'B', [a.id])).json();
      const project = (await createProject(acme, [a.id, b.id])).json();

      expect(b.collaboratorIds).toEqual([a.id]);
      expect(project.organizationId).toBe(acme);
      expect(project.memberIds).toEqual([a.id, b.id]);
    });

    it('deleting an agent leaves other organizations untouched', async () => {
      const acme = await createOrganization('Acme');
      const doomed = (await createAgent(DEFAULT_ORGANIZATION_ID, 'Doomed')).json();
      const boss = (await createAgent(DEFAULT_ORGANIZATION_ID, 'Boss', [doomed.id])).json();
      await createAgent(acme, 'Doomed');

      expect((await call('GET', `/api/organizations/${acme}/agents`)).json()).toHaveLength(1);
      fleet.useCases.deleteAgent.execute(doomed.id);

      expect((await call('GET', `/api/agents/${boss.id}`)).json().collaboratorIds).toEqual([]);
      expect((await call('GET', `/api/organizations/${acme}/agents`)).json()).toHaveLength(1);
    });
  });

  describe('dashboard', () => {
    it('only aggregates the organization data and rejects projects of other organizations', async () => {
      const acme = await createOrganization('Acme');
      const lab = (await createAgent(DEFAULT_ORGANIZATION_ID, 'Lab')).json();
      const labProject = (await createProject(DEFAULT_ORGANIZATION_ID, [lab.id])).json();
      const zed = (await createAgent(acme, 'Zed')).json();
      await createProject(acme, [zed.id], 'Acme project');
      fleet.useCases.assignTask.execute(labProject.id, { agentId: lab.id, title: 'T', description: 'd' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      const labDashboard = (
        await call('GET', `/api/organizations/${DEFAULT_ORGANIZATION_ID}/dashboard`)
      ).json();
      const acmeDashboard = (await call('GET', `/api/organizations/${acme}/dashboard`)).json();
      const foreign = await call('GET', `/api/organizations/${acme}/dashboard?projectId=${labProject.id}`);

      expect(labDashboard.totals.completed).toBe(1);
      expect(acmeDashboard.totals.completed).toBe(0);
      expect(JSON.stringify(acmeDashboard)).not.toContain('Lab');
      expect(foreign.statusCode).toBe(404);
    });
  });
});
