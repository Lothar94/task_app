import type { AddressInfo } from 'node:net';
import type { FleetEvent, FleetStatusDto, SearchResultsDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toTaskDto } from '../../src/application/shared/dtos.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { waitForAbort } from '../support/FakeAgentRuntime.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

describe('global shell QA edge cases', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;

  beforeEach(async () => {
    fleet = createTestFleet({
      CTO: (request) =>
        request.prompt.includes('delegate')
          ? request.delegation
              .delegate({ collaboratorName: 'Dev', title: 'Ñandú subtarea', instructions: 'go' })
              .then(() => waitForAbort(request.signal))
          : waitForAbort(request.signal),
      Dev: (request) => waitForAbort(request.signal),
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const get = <T>(url: string) =>
    app.inject({ method: 'GET', url }).then((response) => ({ status: response.statusCode, body: response.json<T>() }));
  const search = (organizationId: string, query: string) =>
    get<SearchResultsDto>(`/api/organizations/${organizationId}/search?${query}`);
  const fleetStatus = (organizationId = ORG) =>
    get<FleetStatusDto>(`/api/organizations/${organizationId}/fleet-status`);
  const addTask = (projectId: string, agentId: string, title: string, start: 'now' | 'draft' = 'draft') =>
    fleet.useCases.assignTask.execute(projectId, { agentId, title, description: 'd', start });

  describe('search', () => {
    it('matches accents and case in both directions over HTTP', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      addTask(project.id, cto.id, 'Diseño de Navegación');

      for (const q of ['diseno', 'DISEÑO', 'navegacion', 'navegación']) {
        expect((await search(ORG, `q=${encodeURIComponent(q)}`)).body.tasks, q).toHaveLength(1);
      }
    });

    it('ranks the exact task number before titles that merely contain it', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      for (let i = 0; i < 12; i++) addTask(project.id, cto.id, `Item ${i}`);

      const { body } = await search(ORG, 'q=1');
      // number 1 exact first, then titles containing "1" (Item 1, Item 10, Item 11)
      expect(body.tasks[0]?.number).toBe(1);
      expect(body.tasks.every((task) => task.number === 1 || task.title.includes('1'))).toBe(true);
    });

    it('finds subtasks and reports their project', async () => {
      const { cto, project } = await createTeamProject(fleet, ['Dev']);
      fleet.useCases.assignTask.execute(project.id, {
        agentId: cto.id,
        title: 'Parent',
        description: 'please delegate',
      });
      await eventually(async () => expect((await search(ORG, 'q=nandu')).body.tasks).toHaveLength(1));

      const hit = (await search(ORG, 'q=%C3%91and%C3%BA')).body.tasks[0];

      expect(hit).toMatchObject({ title: 'Ñandú subtarea', projectId: project.id, projectName: 'Demo' });
    });

    it('keeps archived projects in the results, flagged archived', async () => {
      const { project } = await createTeamProject(fleet, []);
      expect((await app.inject({ method: 'POST', url: `/api/projects/${project.id}/archive` })).statusCode).toBe(200);

      const { body } = await search(ORG, 'q=demo');

      expect(body.projects).toEqual([{ id: project.id, name: 'Demo', archived: true }]);
    });

    it('finds the tasks of an archived project', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      addTask(project.id, cto.id, 'Legacy cleanup');
      await app.inject({ method: 'POST', url: `/api/projects/${project.id}/archive` });

      expect((await search(ORG, 'q=legacy')).body.tasks).toHaveLength(1);
    });

    it('applies the limit to every group and honours the bounds 1 and 20', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      for (let i = 0; i < 25; i++) addTask(project.id, cto.id, `Report ${i}`);

      expect((await search(ORG, 'q=report&limit=1')).body.tasks).toHaveLength(1);
      expect((await search(ORG, 'q=report&limit=20')).body.tasks).toHaveLength(20);
      expect((await search(ORG, 'q=report')).body.tasks).toHaveLength(5);
    });

    it('ranks exact title above prefix above contains, newest first within a rank', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      addTask(project.id, cto.id, 'Big api rewrite');
      addTask(project.id, cto.id, 'api gateway');
      addTask(project.id, cto.id, 'API');
      addTask(project.id, cto.id, 'api docs');

      const titles = (await search(ORG, 'q=api')).body.tasks.map((task) => task.title);

      expect(titles[0]).toBe('API');
      expect(titles.at(-1)).toBe('Big api rewrite');
      expect(titles.slice(1, 3).sort()).toEqual(['api docs', 'api gateway']);
    });

    it('ranks a task number above title matches in numeric formats', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      addTask(project.id, cto.id, 'Fix issue 2 in billing');
      const second = addTask(project.id, cto.id, 'Unrelated');

      for (const q of ['2', '%232', 'tarea%202', 'task%202', 'Tarea%202']) {
        expect((await search(ORG, `q=${q}`)).body.tasks[0]?.id, q).toBe(second.id);
      }
    });

    it('does not match agent roles of other organizations nor their projects by name', async () => {
      const other = fleet.useCases.createOrganization.execute('Other');
      await createTeamProject(fleet, ['Dev'], other.id);

      const { body } = await search(ORG, 'q=demo');
      expect(body.projects).toEqual([]);
      expect((await search(ORG, 'q=role')).body.agents).toEqual([]);
    });

    it('trims the query and echoes it', async () => {
      await createTeamProject(fleet, []);
      expect((await search(ORG, 'q=%20%20demo%20')).body).toMatchObject({ query: 'demo' });
    });

    it.each([
      ['limit=-1'],
      ['limit='],
      ['limit=NaN'],
    ])('rejects invalid %s with 400', async (limit) => {
      expect((await search(ORG, `q=a&${limit}`)).status).toBe(400);
    });

    it('rejects an over-long query even when it is blank padding', async () => {
      expect((await search(ORG, `q=${'%20'.repeat(201)}`)).status).toBe(400);
    });

    it('does not break on regex and SQL metacharacters', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      addTask(project.id, cto.id, 'a.b (c) [d] %_');
      for (const q of ['.*', '(', '[', "'; DROP TABLE tasks;--", '%', '_', '\\']) {
        expect((await search(ORG, `q=${encodeURIComponent(q)}`)).status, q).toBe(200);
      }
      expect((await search(ORG, `q=${encodeURIComponent('.*')}`)).body.tasks).toEqual([]);
      expect((await search(ORG, `q=${encodeURIComponent('(c)')}`)).body.tasks).toHaveLength(1);
    });
  });

  describe('fleet-status', () => {
    it('counts running tasks of the org only and lists non-active statuses as idle', async () => {
      const { cto, project } = await createTeamProject(fleet, ['Dev']);
      addTask(project.id, cto.id, 'Draft one');
      const other = fleet.useCases.createOrganization.execute('Other');
      const theirs = await createTeamProject(fleet, [], other.id);
      addTask(theirs.project.id, theirs.cto.id, 'Elsewhere', 'now');
      await eventually(async () => expect((await fleetStatus(other.id)).body.activeTasks).toBe(1));

      const mine = (await fleetStatus()).body;
      expect(mine).toMatchObject({ state: 'idle', activeTasks: 0, activeNodes: [], totalAgents: 2 });
      expect((await fleetStatus(other.id)).body).toMatchObject({ totalAgents: 1, activeTasks: 1 });
    });

    it('counts a parent waiting for subtasks and its running child as two active tasks', async () => {
      const { cto, project } = await createTeamProject(fleet, ['Dev']);
      fleet.useCases.assignTask.execute(project.id, {
        agentId: cto.id,
        title: 'Parent',
        description: 'please delegate',
      });
      await eventually(async () => expect((await fleetStatus()).body.activeTasks).toBe(2));

      const { body } = await fleetStatus();

      expect(body.state).toBe('active');
      expect(body.activeNodes.map((node) => [node.name, node.activeTasks])).toEqual([
        ['CTO', 1],
        ['Dev', 1],
      ]);
    });

    it('drops an agent from the active nodes once its task is cancelled', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      const task = addTask(project.id, cto.id, 'Busy', 'now');
      await eventually(async () => expect((await fleetStatus()).body.state).toBe('active'));

      await fleet.useCases.cancelTask.execute(task.id);

      await eventually(async () => expect((await fleetStatus()).body).toMatchObject({ state: 'idle', activeNodes: [] }));
    });

    it('answers 404 for an unknown organization', async () => {
      expect((await fleetStatus('nope')).status).toBe(404);
    });
  });

  describe('SSE organization filter', () => {
    let baseUrl: string;

    beforeEach(async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
      baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    });

    async function seen(query: string, publish: () => void, sentinelProject: string | (() => string)): Promise<string[]> {
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/api/events?${query}`, { signal: controller.signal });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      publish();
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('no sentinel')), 3000));
      const sentinel = () => (typeof sentinelProject === 'string' ? sentinelProject : sentinelProject());
      while (!text.includes(`"projectId":"${sentinel()}"`)) {
        const { value, done } = await Promise.race([reader.read(), timeout]);
        if (done) break;
        text += decoder.decode(value);
      }
      controller.abort();
      return text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => (JSON.parse(line.slice(6)) as FleetEvent).projectId);
    }

    const created = (projectId: string, taskId: string): FleetEvent => ({
      type: 'task.created',
      projectId,
      task: toTaskDto(fleet.useCases.getTask.execute(taskId)),
    });

    it('drops events of an unknown project and of a project of another org', async () => {
      const mine = await createTeamProject(fleet, []);
      const other = fleet.useCases.createOrganization.execute('Other');
      const theirs = await createTeamProject(fleet, [], other.id);
      const mineTask = addTask(mine.project.id, mine.cto.id, 't').id;
      const theirTask = addTask(theirs.project.id, theirs.cto.id, 't').id;

      const projects = await seen(
        `organizationId=${other.id}`,
        () => {
          fleet.events.publish(created('ghost-project', mineTask));
          fleet.events.publish(created(mine.project.id, mineTask));
          fleet.events.publish(created(theirs.project.id, theirTask));
        },
        theirs.project.id,
      );

      expect(projects).toEqual([theirs.project.id]);
    });

    it('streams nothing of other orgs for an organization that does not exist', async () => {
      const mine = await createTeamProject(fleet, []);
      const task = addTask(mine.project.id, mine.cto.id, 't').id;
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/api/events?organizationId=ghost`, { signal: controller.signal });
      const reader = response.body!.getReader();
      fleet.events.publish(created(mine.project.id, task));
      const decoder = new TextDecoder();
      let text = '';
      const deadline = Date.now() + 300;
      while (Date.now() < deadline) {
        const next = await Promise.race([
          reader.read(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
        ]);
        if (next === null) continue;
        if (next.done) break;
        text += decoder.decode(next.value);
      }
      controller.abort();
      expect(text).not.toContain('"type":"task.');
    });

    it('streams events of a project created after the connection opened', async () => {
      const first = await createTeamProject(fleet, []);
      const task = addTask(first.project.id, first.cto.id, 't').id;
      let lateId = 'pending';

      const projects = await seen(
        `organizationId=${ORG}`,
        () => {
          lateId = fleet.useCases.createProject.execute({
            organizationId: ORG,
            details: { name: 'Late', description: '', workspacePath: '/tmp/fleet-test-workspace-late' },
            memberIds: [first.cto.id],
          }).id;
          fleet.events.publish(created(lateId, task));
        },
        () => lateId,
      );

      expect(projects).toEqual([lateId]);
    });
  });
});
