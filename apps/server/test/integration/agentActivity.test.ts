import type { AddressInfo } from 'node:net';
import type { AgentActivityDto, FleetEvent } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { type AgentBehaviour, waitForAbort } from '../support/FakeAgentRuntime.js';
import { createTeamProject, createTestFleet, eventually } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;
const COALESCE_MS = 40;

describe('agent activity over HTTP', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;

  async function start(behaviours: Record<string, AgentBehaviour> = {}) {
    fleet = createTestFleet(behaviours, 4, [], [], { agentActivityCoalesceMs: COALESCE_MS });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
  }
  afterEach(() => app.close());

  const activity = async (organizationId = ORG): Promise<AgentActivityDto> =>
    (await app.inject({ method: 'GET', url: `/api/organizations/${organizationId}/agent-activity` })).json();

  it('answers 404 for an unknown organization', async () => {
    await start();
    const response = await app.inject({ method: 'GET', url: '/api/organizations/ghost/agent-activity' });
    expect(response.statusCode).toBe(404);
  });

  it('reports nobody busy when no task is in progress', async () => {
    await start();
    await createTeamProject(fleet, ['Dev']);
    expect(await activity()).toMatchObject({ organizationId: ORG, agents: [], delegations: [] });
  });

  it('shows who works, who delegates and the delegations in flight', async () => {
    await start({
      CTO: (request) =>
        request.delegation
          .delegate({ collaboratorName: 'Dev', title: 'Sub', instructions: 'Do' })
          .then(() => 'ok'),
      Dev: (request) => waitForAbort(request.signal),
    });
    const { cto, members, project } = await createTeamProject(fleet, ['Dev']);
    const dev = members[0]!;
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Lead',
      description: 'D',
    });

    await eventually(async () => expect((await activity()).agents).toHaveLength(2));

    const snapshot = await activity();
    const subtaskId = snapshot.delegations[0]?.taskId;
    const byId = (a: { agentId: string }, b: { agentId: string }) => a.agentId.localeCompare(b.agentId);
    expect(snapshot.agents).toEqual(
      [
        {
          agentId: dev.id,
          state: 'working',
          currentTask: expect.objectContaining({ taskId: subtaskId, projectId: project.id, title: 'Sub' }),
          activeTasks: 1,
        },
        {
          agentId: cto.id,
          state: 'delegating',
          currentTask: { taskId: root.id, projectId: project.id, number: root.number, title: 'Lead' },
          activeTasks: 1,
        },
      ].sort(byId),
    );
    expect(snapshot.delegations).toEqual([{ fromAgentId: cto.id, toAgentId: dev.id, taskId: subtaskId }]);

    fleet.useCases.cancelTask.execute(root.id);
    await eventually(async () => expect((await activity()).agents).toEqual([]));
  });

  it('publishes one coalesced agent.activity per burst of task changes', async () => {
    await start();
    const { cto, project } = await createTeamProject(fleet, []);
    const events: FleetEvent[] = [];
    fleet.events.subscribe((event) => events.push(event));

    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'T',
      description: 'D',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
    await new Promise((resolve) => setTimeout(resolve, COALESCE_MS * 3));

    const taskChanges = events.filter(
      (event) => event.type === 'task.created' || event.type === 'task.updated',
    );
    const snapshots = events.filter((event) => event.type === 'agent.activity');
    expect(taskChanges.length).toBeGreaterThan(2);
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    expect(snapshots.length).toBeLessThan(taskChanges.length);
    expect(snapshots.at(-1)).toMatchObject({
      organizationId: ORG,
      activity: { organizationId: ORG, agents: [] },
    });
  });

  it('streams agent.activity to its organization but not to project filters', async () => {
    await start({ CTO: (request) => waitForAbort(request.signal) });
    const { cto, project } = await createTeamProject(fleet, []);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const byOrganization = streamEvents(`${baseUrl}/api/events?organizationId=${ORG}`);
    const byProject = streamEvents(`${baseUrl}/api/events?projectId=${project.id}`);
    await Promise.all([byOrganization.ready, byProject.ready]);

    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'T',
      description: 'D',
    });

    await eventually(() =>
      expect(
        byOrganization.events.some(
          (event) => event.type === 'agent.activity' && event.activity.agents.length === 1,
        ),
      ).toBe(true),
    );
    fleet.useCases.cancelTask.execute(task.id);
    await new Promise((resolve) => setTimeout(resolve, COALESCE_MS * 3));
    byOrganization.close();
    byProject.close();

    expect(byProject.events.length).toBeGreaterThan(0);
    expect(byProject.events.some((event) => event.type === 'agent.activity')).toBe(false);
    const activities = byOrganization.events.filter((event) => event.type === 'agent.activity');
    expect(activities.at(-1)).toMatchObject({ activity: { agents: [] } });
  });
});

/** Collects the FleetEvents of one SSE connection until closed. */
function streamEvents(url: string) {
  const controller = new AbortController();
  const events: FleetEvent[] = [];
  let buffer = '';
  const ready = fetch(url, { signal: controller.signal }).then((response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const pump = (): Promise<void> =>
      reader.read().then(({ value, done }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          if (block.startsWith('data: ')) events.push(JSON.parse(block.slice('data: '.length)) as FleetEvent);
        }
        return pump();
      });
    pump().catch(() => undefined);
  });
  return { ready, events, close: () => controller.abort() };
}
