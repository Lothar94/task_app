import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AGENT_EXPORT_FORMAT,
  AGENT_EXPORT_VERSION,
  type AgentActivityDto,
  type AgentDto,
  type FleetEvent,
  MAX_AGENT_MCP_SERVERS,
} from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollaboratorInfo, DelegationGateway } from '../../src/application/ports/AgentRuntime.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { ClaudeUserMcpServers } from '../../src/infrastructure/runtime/claude/ClaudeUserMcpServers.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { type AgentBehaviour, waitForAbort } from '../support/FakeAgentRuntime.js';
import { createTeamProject, createTestFleet, eventually, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;
const COALESCE_MS = 40;
const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('QA: agent sheet settings validation and persistence', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;

  beforeEach(async () => {
    fleet = createTestFleet();
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: silentLogger,
      allowedOrigin: '*',
    });
  });
  afterEach(() => app.close());

  const createAgent = (payload: object) =>
    app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents`, payload });
  const updateAgent = (id: string, payload: object) =>
    app.inject({ method: 'PUT', url: `/api/agents/${id}`, payload });
  const names = (count: number) => Array.from({ length: count }, (_, index) => `srv-${index}`);

  it.each([1, 128_000])('accepts the output cap boundary %i and stores it as is', async (cap) => {
    const response = await createAgent({ ...profile('Dev'), maxOutputTokens: cap });
    expect(response.statusCode).toBe(201);
    expect(response.json().maxOutputTokens).toBe(cap);
  });

  it.each([-1, 0, 128_001, 1.5, 1e9, '100', true, []])(
    'rejects output cap %j on update and leaves the agent unchanged',
    async (cap) => {
      const dto: AgentDto = (await createAgent({ ...profile('Dev'), maxOutputTokens: 500 })).json();
      const response = await updateAgent(dto.id, { ...profile('Dev'), maxOutputTokens: cap });
      expect(response.statusCode).toBe(400);
      const stored = await app.inject({ method: 'GET', url: `/api/agents/${dto.id}` });
      expect(stored.json().maxOutputTokens).toBe(500);
    },
  );

  it('accepts exactly the maximum number of MCP servers and rejects one more', async () => {
    const ok = await createAgent({ ...profile('Dev'), mcpServers: names(MAX_AGENT_MCP_SERVERS) });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().mcpServers).toHaveLength(MAX_AGENT_MCP_SERVERS);
    const tooMany = await createAgent({ ...profile('Dev2'), mcpServers: names(MAX_AGENT_MCP_SERVERS + 1) });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().error).toMatch(/at most/);
  });

  it('counts duplicates once, so a list over the limit made of repeats is still valid', async () => {
    const response = await createAgent({
      ...profile('Dev'),
      mcpServers: [...names(MAX_AGENT_MCP_SERVERS), ...names(5), ' srv-0 '],
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().mcpServers).toHaveLength(MAX_AGENT_MCP_SERVERS);
  });

  it.each([['a.b'], ['a:b'], ['a/b'], ['a b'], ['ñandú'], ['x'.repeat(65)], [42], [null], [['nested']]])(
    'rejects the invalid MCP server list %j',
    async (...mcpServers) => {
      const response = await createAgent({ ...profile('Dev'), mcpServers });
      expect(response.statusCode).toBe(400);
    },
  );

  it('accepts a 64-character MCP server name', async () => {
    const response = await createAgent({ ...profile('Dev'), mcpServers: ['x'.repeat(64)] });
    expect(response.statusCode).toBe(201);
  });

  it('defaults the omitted fields on create to null, null and []', async () => {
    const { temperature: _t, maxOutputTokens: _m, mcpServers: _s, ...legacy } = profile('Dev');
    const response = await createAgent(legacy);
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      temperature: null,
      maxOutputTokens: null,
      mcpServers: [],
      enabled: true,
    });
  });

  it.each([0, 1])('accepts the temperature boundary %i once supported', async (temperature) => {
    fleet.runtime.supports.temperature = true;
    const response = await createAgent({ ...profile('Dev'), temperature });
    expect(response.statusCode).toBe(201);
    expect(response.json().temperature).toBe(temperature);
  });

  it.each(['0.5', true, [0.5], 2, -1])('rejects temperature %j even when supported', async (temperature) => {
    fleet.runtime.supports.temperature = true;
    expect((await createAgent({ ...profile('Dev'), temperature })).statusCode).toBe(400);
  });

  it('round-trips temperature, cap and servers through export and import', async () => {
    fleet.runtime.supports.temperature = true;
    await createAgent({
      ...profile('Dev'),
      temperature: 0.25,
      maxOutputTokens: 128_000,
      mcpServers: ['docs', 'github'],
    });
    const file = (
      await app.inject({ method: 'POST', url: `/api/organizations/${ORG}/agents/export`, payload: {} })
    ).json();
    const other = fleet.useCases.createOrganization.execute('Other');

    const imported = await app.inject({
      method: 'POST',
      url: `/api/organizations/${other.id}/agents/import`,
      payload: { file },
    });

    expect(imported.statusCode).toBe(201);
    expect(imported.json().imported[0]).toMatchObject({
      name: 'Dev',
      temperature: 0.25,
      maxOutputTokens: 128_000,
      mcpServers: ['docs', 'github'],
    });
  });

  it('rejects an import file whose agent has an out-of-range cap or too many servers, as a whole', async () => {
    const file = (agents: object[]) => ({ format: AGENT_EXPORT_FORMAT, version: AGENT_EXPORT_VERSION, agents });
    const importFile = (agents: object[]) =>
      app.inject({
        method: 'POST',
        url: `/api/organizations/${ORG}/agents/import`,
        payload: { file: file(agents) },
      });
    const good = { ...profile('Good'), collaborators: [] };
    expect((await importFile([good, { ...profile('Bad'), maxOutputTokens: 0, collaborators: [] }])).statusCode).toBe(400);
    expect(
      (await importFile([good, { ...profile('Bad'), mcpServers: names(21), collaborators: [] }])).statusCode,
    ).toBe(400);
    expect(fleet.useCases.listAgents.execute(ORG)).toEqual([]);
  });
});

describe('QA: disabled agents', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;
  let ctoAction: (gateway: DelegationGateway) => Promise<unknown> | unknown;
  let ctoOutcome: { listed?: CollaboratorInfo[]; error?: unknown; result?: unknown };
  let releaseDev: () => void;

  beforeEach(async () => {
    ctoOutcome = {};
    ctoAction = () => undefined;
    const devGate = new Promise<void>((resolve) => (releaseDev = resolve));
    fleet = createTestFleet({
      CTO: async (request) => {
        ctoOutcome.listed = request.delegation.listCollaborators();
        try {
          ctoOutcome.result = await ctoAction(request.delegation);
        } catch (error) {
          ctoOutcome.error = error;
        }
        return 'CTO done';
      },
      Dev: () => devGate.then(() => 'Dev done'),
    });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: silentLogger,
      allowedOrigin: '*',
    });
  });
  afterEach(async () => {
    releaseDev();
    await app.close();
  });

  const setEnabled = (agentId: string, enabled: boolean) =>
    app.inject({ method: 'PUT', url: `/api/agents/${agentId}/enabled`, payload: { enabled } });
  const postTask = (projectId: string, agentId: string) =>
    app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tasks`,
      payload: { agentId, title: 'T', description: 'D' },
    });

  async function runCto(project: { id: string }, ctoId: string) {
    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: ctoId,
      title: 'Lead',
      description: 'Lead',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
  }

  it('re-enabling restores task creation, listing as collaborator and delegation', async () => {
    const { project, cto, members } = await createTeamProject(fleet, ['Dev']);
    const dev = members[0]!;
    await setEnabled(dev.id, false);
    expect((await postTask(project.id, dev.id)).statusCode).toBe(409);

    expect((await setEnabled(dev.id, true)).statusCode).toBe(200);
    ctoAction = (gateway) => gateway.delegate({ collaboratorName: 'Dev', title: 'Sub', instructions: 'Go' });
    releaseDev();
    await runCto(project, cto.id);

    expect(ctoOutcome.error).toBeUndefined();
    expect(ctoOutcome.listed?.map((collaborator) => collaborator.name)).toEqual(['Dev']);
    expect((await postTask(project.id, dev.id)).statusCode).toBe(201);
  });

  it('is idempotent: disabling twice stays disabled and enabling twice stays enabled', async () => {
    const { members } = await createTeamProject(fleet, ['Dev']);
    const id = members[0]!.id;
    expect((await setEnabled(id, false)).json().enabled).toBe(false);
    expect((await setEnabled(id, false)).json().enabled).toBe(false);
    expect((await setEnabled(id, true)).json().enabled).toBe(true);
    expect((await setEnabled(id, true)).json().enabled).toBe(true);
  });

  it('keeps an agent disabled when its sheet is saved through PUT /api/agents/:id', async () => {
    const { members } = await createTeamProject(fleet, ['Dev']);
    const dev = members[0]!;
    await setEnabled(dev.id, false);

    const saved = await app.inject({
      method: 'PUT',
      url: `/api/agents/${dev.id}`,
      payload: { ...profile('Dev'), maxTurns: 7 },
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ maxTurns: 7, enabled: false });
  });

  it('lets a task already running finish after its agent is disabled', async () => {
    const { project, members } = await createTeamProject(fleet, ['Dev']);
    const dev = members[0]!;
    const task = fleet.useCases.assignTask.execute(project.id, {
      agentId: dev.id,
      title: 'Long',
      description: 'D',
    });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('running'));

    await setEnabled(dev.id, false);
    releaseDev();

    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
    expect(fleet.useCases.getAgent.execute(dev.id).enabled).toBe(false);
  });

  it('rejects creating a task for a disabled agent in a draft too, without creating anything', async () => {
    const { project, members } = await createTeamProject(fleet, ['Dev']);
    const dev = members[0]!;
    await setEnabled(dev.id, false);

    const response = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/tasks`,
      payload: { agentId: dev.id, title: 'T', description: 'D', start: 'draft' },
    });

    expect(response.statusCode).toBe(409);
    const tasks = await app.inject({ method: 'GET', url: `/api/projects/${project.id}/tasks` });
    expect(tasks.json()).toEqual([]);
  });

  it('delegating to a disabled agent is rejected and nothing is run for it', async () => {
    const { project, cto, members } = await createTeamProject(fleet, ['Dev']);
    await setEnabled(members[0]!.id, false);
    ctoAction = (gateway) => gateway.delegate({ collaboratorName: 'Dev', title: 'Sub', instructions: 'Go' });

    await runCto(project, cto.id);

    expect(ctoOutcome.error).toMatchObject({ message: expect.stringMatching(/disabled/) });
    expect(fleet.runtime.requests.every((request) => !request.systemPromptAppendix.includes('"Dev"'))).toBe(true);
  });
});

describe('QA: agent.activity over SSE', () => {
  let fleet: ReturnType<typeof createTestFleet>;
  let app: FastifyInstance;
  let baseUrl: string;

  async function start(behaviours: Record<string, AgentBehaviour>) {
    fleet = createTestFleet(behaviours, 4, [], [], { agentActivityCoalesceMs: COALESCE_MS });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: silentLogger,
      allowedOrigin: '*',
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }
  afterEach(() => app.close());

  const snapshots = (events: FleetEvent[]) =>
    events.flatMap((event) => (event.type === 'agent.activity' ? [event] : []));

  it('delivers the delegation snapshot to unfiltered and organization streams but not to other organizations', async () => {
    await start({
      CTO: (request) =>
        request.delegation
          .delegate({ collaboratorName: 'Dev', title: 'Sub', instructions: 'Do' })
          .then(() => 'ok'),
      Dev: (request) => waitForAbort(request.signal),
    });
    const { cto, members, project } = await createTeamProject(fleet, ['Dev']);
    const other = fleet.useCases.createOrganization.execute('Other');
    const all = streamEvents(`${baseUrl}/api/events`);
    const own = streamEvents(`${baseUrl}/api/events?organizationId=${ORG}`);
    const foreign = streamEvents(`${baseUrl}/api/events?organizationId=${other.id}`);
    const byProject = streamEvents(`${baseUrl}/api/events?projectId=${project.id}&organizationId=${ORG}`);
    await Promise.all([all.ready, own.ready, foreign.ready, byProject.ready]);

    const root = fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Lead', description: 'D' });
    const bothBusy = (activity: AgentActivityDto) => activity.agents.length === 2;
    await eventually(() => {
      expect(snapshots(all.events).some((event) => bothBusy(event.activity))).toBe(true);
      expect(snapshots(own.events).some((event) => bothBusy(event.activity))).toBe(true);
    });
    const busy = snapshots(own.events).find((event) => bothBusy(event.activity))!.activity;
    const dev = members[0]!;
    expect(busy.agents.find((agent) => agent.agentId === cto.id)).toMatchObject({
      state: 'delegating',
      currentTask: { taskId: root.id, title: 'Lead', projectId: project.id },
    });
    expect(busy.agents.find((agent) => agent.agentId === dev.id)).toMatchObject({
      state: 'working',
      currentTask: { title: 'Sub' },
    });
    expect(busy.delegations).toEqual([
      { fromAgentId: cto.id, toAgentId: dev.id, taskId: busy.agents.find((a) => a.agentId === dev.id)!.currentTask.taskId },
    ]);

    fleet.useCases.cancelTask.execute(root.id);
    await eventually(() => expect(snapshots(own.events).at(-1)?.activity.agents).toEqual([]));
    await new Promise((resolve) => setTimeout(resolve, COALESCE_MS * 3));
    for (const stream of [all, own, foreign, byProject]) stream.close();

    expect(snapshots(foreign.events)).toEqual([]);
    expect(snapshots(byProject.events)).toEqual([]);
    expect(byProject.events.length).toBeGreaterThan(0);
    expect(snapshots(all.events).at(-1)?.activity.agents).toEqual([]);
  });

  it('coalesces on the wire: far fewer snapshots than task events for a finished task', async () => {
    await start({});
    const { cto, project } = await createTeamProject(fleet, []);
    const all = streamEvents(`${baseUrl}/api/events`);
    await all.ready;

    const task = fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'T', description: 'D' });
    await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
    await new Promise((resolve) => setTimeout(resolve, COALESCE_MS * 4));
    all.close();

    const taskEvents = all.events.filter((event) => event.type === 'task.created' || event.type === 'task.updated');
    expect(snapshots(all.events).length).toBeGreaterThanOrEqual(1);
    expect(snapshots(all.events).length).toBeLessThan(taskEvents.length);
    expect(snapshots(all.events).every((event) => event.organizationId === event.activity.organizationId)).toBe(true);
  });
});

describe('QA: MCP catalog never exposes launch configs', () => {
  const SECRETS = ['ghp_SECRET_TOKEN', '--api-key=SECRETARG', 'Bearer SECRETHEADER', 'user:SECRETPASS@', '/opt/secret-bin'];
  let dir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vega-mcp-'));
    const file = join(dir, '.claude.json');
    await writeFile(
      file,
      JSON.stringify({
        mcpServers: {
          github: { command: '/opt/secret-bin', args: ['--api-key=SECRETARG'], env: { TOKEN: 'ghp_SECRET_TOKEN' } },
          remote: { type: 'http', url: 'https://user:SECRETPASS@mcp.example/x', headers: { Authorization: 'Bearer SECRETHEADER' } },
        },
      }),
    );
    const fleet = createTestFleet({}, 4, [], [], { mcpServerCatalog: new ClaudeUserMcpServers(file, silentLogger) });
    app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: silentLogger,
      allowedOrigin: '*',
    });
  });
  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('lists names and transports only on /api/agent-runtime, and agents/export carry only names', async () => {
    const runtime = await app.inject({ method: 'GET', url: '/api/agent-runtime' });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json().mcpServers).toEqual([
      { name: 'github', transport: 'stdio' },
      { name: 'remote', transport: 'http' },
    ]);
    const created = await app.inject({
      method: 'POST',
      url: `/api/organizations/${ORG}/agents`,
      payload: { ...profile('Dev'), mcpServers: ['github', 'remote'] },
    });
    const exported = await app.inject({
      method: 'POST',
      url: `/api/organizations/${ORG}/agents/export`,
      payload: {},
    });
    const everything = [runtime.body, created.body, exported.body].join('\n');
    for (const secret of SECRETS) expect(everything).not.toContain(secret);
    for (const field of ['command', 'args', 'env', 'url', 'headers']) {
      expect(Object.keys(runtime.json().mcpServers[0])).not.toContain(field);
    }
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
