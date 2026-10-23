import type { AddressInfo } from 'node:net';
import type { FleetEvent, FleetStatusDto, SearchResultsDto } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toTaskDto } from '../../src/application/shared/dtos.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import {
  createTeamProject,
  createTestFleet,
  eventually,
  TEST_APP_VERSION,
} from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

describe('shell endpoints', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;
  let release: () => void;

  beforeEach(async () => {
    const released = new Promise<string>((resolve) => {
      release = () => resolve('done');
    });
    fleet = createTestFleet({ CTO: () => released, Dev: () => released });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  });

  afterEach(async () => {
    release();
    await app.close();
  });

  const get = <T>(url: string) =>
    app.inject({ method: 'GET', url }).then((response) => ({ status: response.statusCode, body: response.json<T>() }));

  const addTask = (projectId: string, agentId: string, title: string, start: 'now' | 'draft' = 'draft') =>
    fleet.useCases.assignTask.execute(projectId, { agentId, title, description: 'd', start });

  const search = (organizationId: string, query: string) =>
    get<SearchResultsDto>(`/api/organizations/${organizationId}/search?${query}`);

  describe('GET /api/organizations/:id/search', () => {
    it('groups projects, tasks and agents, including subtasks', async () => {
      const { cto, project } = await createTeamProject(fleet, ['Dev']);
      const parent = addTask(project.id, cto.id, 'Billing refactor');
      fleet.useCases.assignTask.execute(project.id, {
        agentId: cto.id,
        title: 'Billing subtask',
        description: 'd',
        start: 'draft',
      });

      const { status, body } = await search(ORG, 'q=billing');

      expect(status).toBe(200);
      expect(body.query).toBe('billing');
      expect(body.tasks.map((task) => task.title).sort()).toEqual(['Billing refactor', 'Billing subtask']);
      expect(body.tasks[0]).toMatchObject({ projectId: project.id, projectName: 'Demo', status: 'draft' });
      expect(parent.id).toBeTruthy();

      const named = (await search(ORG, 'q=demo')).body;
      expect(named.projects).toEqual([{ id: project.id, name: 'Demo', archived: false }]);
      const agents = (await search(ORG, 'q=dev')).body.agents;
      expect(agents).toMatchObject([{ name: 'Dev', role: 'Dev role' }]);
    });

    it('finds tasks by number in the formats of the contract', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      addTask(project.id, cto.id, 'First');
      const second = addTask(project.id, cto.id, 'Second');

      for (const q of ['2', '%232', 'tarea%202', 'TASK%202']) {
        const { body } = await search(ORG, `q=${q}`);
        expect(body.tasks[0]?.id, q).toBe(second.id);
      }
    });

    it('never returns data of another organization', async () => {
      await createTeamProject(fleet, ['Dev']);
      const other = fleet.useCases.createOrganization.execute('Other');
      const { cto, project } = await createTeamProject(fleet, [], other.id);
      addTask(project.id, cto.id, 'Secret plan');

      const mine = (await search(ORG, 'q=secret')).body;
      expect(mine).toEqual({ query: 'secret', projects: [], tasks: [], agents: [] });
      expect((await search(ORG, 'q=1')).body.tasks).toEqual([]);

      const theirs = (await search(other.id, 'q=secret')).body;
      expect(theirs.tasks).toHaveLength(1);
      expect((await search(other.id, 'q=dev')).body.agents).toEqual([]);
    });

    it('answers empty groups for an empty, blank or missing query', async () => {
      await createTeamProject(fleet, []);
      for (const url of ['q=', 'q=%20%20', '']) {
        const { status, body } = await search(ORG, url);
        expect(status).toBe(200);
        expect(body).toEqual({ query: '', projects: [], tasks: [], agents: [] });
      }
    });

    it('caps each group by limit', async () => {
      const { cto, project } = await createTeamProject(fleet, []);
      for (let i = 0; i < 4; i++) addTask(project.id, cto.id, `Report ${i}`);

      expect((await search(ORG, 'q=report&limit=2')).body.tasks).toHaveLength(2);
      expect((await search(ORG, 'q=report')).body.tasks).toHaveLength(4);
    });

    it('answers 404 for a missing organization', async () => {
      const { status, body } = await search('missing', 'q=x');
      expect(status).toBe(404);
      expect(body).toHaveProperty('error');
    });

    it.each([
      ['a query over 200 characters', `q=${'a'.repeat(201)}`],
      ['limit 0', 'q=a&limit=0'],
      ['limit over the maximum', 'q=a&limit=21'],
      ['a non-integer limit', 'q=a&limit=2.5'],
      ['a non-numeric limit', 'q=a&limit=many'],
    ])('answers 400 for %s', async (_name, query) => {
      expect((await search(ORG, query)).status).toBe(400);
    });

    it('accepts a query of exactly 200 characters', async () => {
      expect((await search(ORG, `q=${'a'.repeat(200)}`)).status).toBe(200);
    });
  });

  describe('GET /api/organizations/:id/fleet-status', () => {
    const status = (organizationId = ORG) => get<FleetStatusDto>(`/api/organizations/${organizationId}/fleet-status`);

    it('is idle with the agent count and the app version when nothing runs', async () => {
      const { cto, project } = await createTeamProject(fleet, ['Dev']);
      addTask(project.id, cto.id, 'Planned');

      const { status: code, body } = await status();

      expect(code).toBe(200);
      expect(body).toMatchObject({
        state: 'idle',
        activeNodes: [],
        totalAgents: 2,
        activeTasks: 0,
        version: TEST_APP_VERSION,
      });
      expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
    });

    it('is active with the busy agents ordered by load then name', async () => {
      const { cto, members, project } = await createTeamProject(fleet, ['Dev']);
      const [dev] = members;
      addTask(project.id, dev!.id, 'Dev work', 'now');
      addTask(project.id, cto.id, 'CTO work 1', 'now');
      await eventually(async () => expect((await status()).body.activeTasks).toBe(2));

      const { body } = await status();

      expect(body.state).toBe('active');
      expect(body.activeNodes.map((node) => [node.name, node.activeTasks])).toEqual([
        ['CTO', 1],
        ['Dev', 1],
      ]);
    });

    it('ignores the activity of other organizations', async () => {
      const other = fleet.useCases.createOrganization.execute('Other');
      const { cto, project } = await createTeamProject(fleet, [], other.id);
      addTask(project.id, cto.id, 'Busy elsewhere', 'now');
      await eventually(async () => expect((await status(other.id)).body.state).toBe('active'));

      const mine = (await status()).body;

      expect(mine).toMatchObject({ state: 'idle', activeNodes: [], totalAgents: 0 });
    });

    it('answers 404 for a missing organization', async () => {
      expect((await status('missing')).status).toBe(404);
    });
  });

  describe('GET /api/events?organizationId=', () => {
    let baseUrl: string;

    beforeEach(async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
      baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    });

    const created = (projectId: string, taskId: string): FleetEvent => ({
      type: 'task.created',
      projectId,
      task: toTaskDto(fleet.useCases.getTask.execute(taskId)),
    });

    /** Reads the stream until the sentinel project shows up and returns every project id seen. */
    async function streamedProjects(query: string, publish: () => void, sentinel: string): Promise<string[]> {
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/api/events?${query}`, { signal: controller.signal });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      publish();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('sentinel event never streamed')), 3000),
      );
      while (!text.includes(`"projectId":"${sentinel}"`)) {
        const { value, done } = await Promise.race([reader.read(), timeout]);
        if (done) break;
        text += decoder.decode(value);
      }
      controller.abort();
      return text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => JSON.parse(line.slice('data: '.length)) as FleetEvent)
        .flatMap((event) => ('projectId' in event ? [event.projectId] : []));
    }

    async function twoOrganizations() {
      const mine = await createTeamProject(fleet, []);
      const other = fleet.useCases.createOrganization.execute('Other');
      const theirs = await createTeamProject(fleet, [], other.id);
      const myOther = fleet.useCases.createProject.execute({
        organizationId: ORG,
        details: { name: 'Second', description: '', workspacePath: '/tmp/fleet-test-workspace-2' },
        memberIds: [mine.cto.id],
      });
      const task = (projectId: string, agentId: string) => addTask(projectId, agentId, 't').id;
      return {
        mine,
        theirs,
        myOther,
        mineTask: task(mine.project.id, mine.cto.id),
        theirTask: task(theirs.project.id, theirs.cto.id),
        myOtherTask: task(myOther.id, mine.cto.id),
        other,
      };
    }

    it('streams only the events of projects of that organization', async () => {
      const s = await twoOrganizations();

      const seen = await streamedProjects(
        `organizationId=${ORG}`,
        () => {
          fleet.events.publish(created(s.theirs.project.id, s.theirTask));
          fleet.events.publish(created(s.mine.project.id, s.mineTask));
          fleet.events.publish(created(s.myOther.id, s.myOtherTask));
        },
        s.myOther.id,
      );

      expect(seen).toEqual([s.mine.project.id, s.myOther.id]);
    });

    it('combines organizationId and projectId', async () => {
      const s = await twoOrganizations();

      const seen = await streamedProjects(
        `organizationId=${ORG}&projectId=${s.myOther.id}`,
        () => {
          fleet.events.publish(created(s.mine.project.id, s.mineTask));
          fleet.events.publish(created(s.theirs.project.id, s.theirTask));
          fleet.events.publish(created(s.myOther.id, s.myOtherTask));
        },
        s.myOther.id,
      );

      expect(seen).toEqual([s.myOther.id]);
    });

    it('keeps the projectId filter working alone', async () => {
      const s = await twoOrganizations();

      const seen = await streamedProjects(
        `projectId=${s.theirs.project.id}`,
        () => {
          fleet.events.publish(created(s.mine.project.id, s.mineTask));
          fleet.events.publish(created(s.theirs.project.id, s.theirTask));
        },
        s.theirs.project.id,
      );

      expect(seen).toEqual([s.theirs.project.id]);
    });
  });
});
