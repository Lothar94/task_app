import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../src/domain/errors/DomainError.js';
import { createContainer } from '../../src/main/container.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import { waitForAbort, FakeAgentRuntime } from '../support/FakeAgentRuntime.js';
import {
  createTeamProject,
  createTestFleet,
  eventually,
  FakeInstructionWriter,
  fakeSkillSupport,
} from '../support/testFleet.js';

type Start = 'now' | 'draft' | 'queue';

/** Agents block while their prompt contains "hold" until `release()`; "boom" fails; "cancelme" waits for abort. */
function setup() {
  let release: () => void = () => undefined;
  const gate = new Promise<string>((resolve) => (release = () => resolve('done')));
  const reached: string[] = [];
  const fleet = createTestFleet({
    CTO: (request) => {
      reached.push(request.prompt);
      if (request.prompt.includes('boom')) throw new Error('boom');
      if (request.prompt.includes('cancelme')) return waitForAbort(request.signal);
      return request.prompt.includes('hold') ? gate : 'ok';
    },
  });
  return { fleet, reached, release: () => release() };
}

async function setupProject() {
  const ctx = setup();
  const { cto, project } = await createTeamProject(ctx.fleet, []);
  const { useCases } = ctx.fleet;
  const add = (title: string, start: Start = 'queue', extra: Record<string, unknown> = {}) =>
    useCases.assignTask.execute(project.id, { agentId: cto.id, title, description: 'D', start, ...extra }).id;
  const task = (id: string) => useCases.getTask.execute(id);
  const status = (id: string) => task(id).status;
  const queueOf = () =>
    useCases.getTaskTree
      .execute(project.id)
      .filter((t) => t.status === 'queued')
      .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0))
      .map((t) => [t.title, t.queuePosition]);
  return { ...ctx, ...ctx.fleet, cto, project, add, task, status, queueOf };
}

describe('queue progression (QA)', () => {
  it('starts the next task when the running one is cancelled', async () => {
    const { add, status, useCases, release, reached } = await setupProject();
    const first = add('cancelme first');
    const second = add('second');
    // The abort listener is only registered once the agent behaviour runs.
    await eventually(() => expect(reached).toHaveLength(1));

    useCases.cancelTask.execute(first);

    await eventually(() => expect(status(first)).toBe('cancelled'));
    await eventually(() => expect(status(second)).toBe('completed'));
    release();
  });

  it('starts the next task when the running one fails', async () => {
    const { add, status } = await setupProject();
    const first = add('boom first');
    const second = add('second');

    await eventually(() => expect(status(first)).toBe('failed'));
    await eventually(() => expect(status(second)).toBe('completed'));
  });

  it('keeps the queue blocked while a follow-up of a finished root runs', async () => {
    const { add, status, useCases, runtime, release, task, queueOf } = await setupProject();
    const done = add('done', 'now');
    await eventually(() => expect(status(done)).toBe('completed'));

    useCases.sendFollowUp.execute(done, 'hold please');
    const queued = add('later');

    await eventually(() => expect(runtime.requests).toHaveLength(2));
    expect(status(done)).toBe('running');
    expect(status(queued)).toBe('queued');
    expect(queueOf()).toEqual([['later', 1]]);
    expect(task(queued).queuePosition).toBe(1);

    release();
    await eventually(() => expect(status(queued)).toBe('completed'));
  });

  it('does not let a follow-up of a finished task sneak past a running queue head', async () => {
    const { add, status, useCases, release } = await setupProject();
    const done = add('done', 'now');
    await eventually(() => expect(status(done)).toBe('completed'));
    const head = add('hold head');
    await eventually(() => expect(status(head)).toBe('running'));
    const next = add('next');

    useCases.sendFollowUp.execute(done, 'hold follow-up');

    expect(status(next)).toBe('queued');
    release();
    await eventually(() => expect(status(next)).toBe('completed'));
  });

  it('starts a draft manually when the queue is empty', async () => {
    const { add, status, useCases, runtime } = await setupProject();
    const draft = add('draft', 'draft');

    useCases.startTask.execute(draft);

    await eventually(() => expect(status(draft)).toBe('completed'));
    expect(runtime.requests).toHaveLength(1);
  });

  it('starts a draft manually while the queue is busy, skipping the queue without disturbing it', async () => {
    const { add, status, useCases, release, queueOf } = await setupProject();
    const head = add('hold head');
    const waiting = add('waiting');
    const draft = add('draft', 'draft');
    await eventually(() => expect(status(head)).toBe('running'));

    useCases.startTask.execute(draft);

    await eventually(() => expect(status(draft)).toBe('completed'));
    expect(status(head)).toBe('running');
    expect(queueOf()).toEqual([['waiting', 1]]);
    release();
    await eventually(() => expect(status(waiting)).toBe('completed'));
  });

  it('does not start a queued task while a root is active, and cancelling a queued task leaves the head running', async () => {
    const { add, status, useCases, release } = await setupProject();
    const head = add('hold head', 'now');
    const queued = add('queued');
    await eventually(() => expect(status(head)).toBe('running'));
    expect(status(queued)).toBe('queued');
    useCases.cancelTask.execute(queued);
    expect(status(queued)).toBe('cancelled');
    release();
  });
});

describe('planning guards (QA)', () => {
  it.each(['queued', 'running', 'completed', 'cancelled'])(
    'enqueue of a %s task is a conflict',
    async (kind) => {
      const { add, status, useCases, release } = await setupProject();
      const blocker = add('hold blocker', 'now');
      await eventually(() => expect(status(blocker)).toBe('running'));
      const id =
        kind === 'queued'
          ? add('q')
          : kind === 'running'
            ? blocker
            : kind === 'cancelled'
              ? add('c', 'draft')
              : add('x', 'draft');
      if (kind === 'cancelled') useCases.cancelTask.execute(id);
      if (kind === 'completed') {
        release();
        useCases.startTask.execute(id);
        await eventually(() => expect(status(id)).toBe('completed'));
      }

      expect(() => useCases.enqueueTask.execute(id)).toThrow(ConflictError);
      release();
    },
  );

  it('rejects start, dequeue and edits of definition for non-planned tasks', async () => {
    const { add, status, useCases } = await setupProject();
    const done = add('done', 'now');
    await eventually(() => expect(status(done)).toBe('completed'));

    expect(() => useCases.startTask.execute(done)).toThrow(ConflictError);
    expect(() => useCases.dequeueTask.execute(done)).toThrow(ConflictError);
    expect(() => useCases.updateTask.execute(done, { description: 'x' })).toThrow(ConflictError);
    expect(() => useCases.updateTask.execute(done, { agentId: done })).toThrow();
  });

  it('applies every planning operation to subtasks as a conflict', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<string>((resolve) => (release = () => resolve('done')));
    const fleet = createTestFleet({
      CTO: (r) =>
        r.delegation
          .delegate({ collaboratorName: 'Backend', title: 'sub', instructions: 'i' })
          .then(() => 'ok'),
      Backend: () => gate,
    });
    const { cto, project } = await createTeamProject(fleet, ['Backend']);
    const { useCases } = fleet;
    useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'root', description: 'd' });
    await eventually(() => expect(useCases.getTaskTree.execute(project.id)[0]?.children).toHaveLength(1));
    const childId = useCases.getTaskTree.execute(project.id)[0]?.children[0]?.id as string;

    expect(() => useCases.dequeueTask.execute(childId)).toThrow(ConflictError);
    expect(() => useCases.updateTask.execute(childId, { milestone: 'm' })).toThrow(ConflictError);
    release();
  });

  it('rejects PATCH agentId for an agent that is not a project member', async () => {
    const { add, useCases, fleet } = await setupProject();
    const outsider = await fleet.useCases.createAgent.execute({
      organizationId: DEFAULT_ORGANIZATION_ID,
      profile: {
        name: 'Out',
        role: 'r',
        description: '',
        instructions: 'i',
        model: 'sonnet',
        effort: 'high',
        modelSelection: 'fixed',
        allowedTools: [],
        skills: [],
        permissionMode: 'dontAsk',
        maxTurns: 5,
      },
      collaboratorIds: [],
    });
    const draft = add('d', 'draft');

    expect(() => useCases.updateTask.execute(draft, { agentId: outsider.id })).toThrow(ValidationError);
  });

  it('rejects reorders with duplicated, missing or foreign ids', async () => {
    const { add, project, useCases, queueOf } = await setupProject();
    add('hold head');
    const a = add('a');
    const b = add('b');
    const draft = add('draft', 'draft');

    expect(() => useCases.reorderQueue.execute(project.id, [a, a])).toThrow(ValidationError);
    expect(() => useCases.reorderQueue.execute(project.id, [a, draft])).toThrow(ValidationError);
    expect(() => useCases.reorderQueue.execute(project.id, [a, b, b])).toThrow(ValidationError);
    expect(() => useCases.reorderQueue.execute(project.id, [])).toThrow(ValidationError);
    expect(queueOf()).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('task.updated events (QA)', () => {
  it('emits an update for every task whose position changes', async () => {
    const { add, status, useCases, events, project, release } = await setupProject();
    const head = add('hold head');
    const a = add('a');
    const b = add('b');
    const c = add('c');
    await eventually(() => expect(status(head)).toBe('running'));
    const seen: Array<[string, number | null, string]> = [];
    events.subscribe((event) => {
      if (event.type === 'task.updated')
        seen.push([event.task.id, event.task.queuePosition, event.task.status]);
    });

    useCases.dequeueTask.execute(a);
    expect(seen).toContainEqual([a, null, 'draft']);
    expect(seen).toContainEqual([b, 1, 'queued']);
    expect(seen).toContainEqual([c, 2, 'queued']);

    seen.length = 0;
    useCases.reorderQueue.execute(project.id, [c, b]);
    expect(seen).toEqual([
      [c, 1, 'queued'],
      [b, 2, 'queued'],
    ]);

    seen.length = 0;
    useCases.cancelTask.execute(c);
    expect(seen).toContainEqual([c, null, 'cancelled']);
    expect(seen).toContainEqual([b, 1, 'queued']);
    release();
  });
});

describe('tags and milestone normalisation (QA)', () => {
  it('dedupes tags case-insensitively keeping the first spelling, drops blanks, honours the limits', async () => {
    const { add, task } = await setupProject();
    const id = add('t', 'draft', { tags: ['Bug', 'bug', ' BUG ', '', '  ', 'x'.repeat(40)] });
    expect(task(id).tags).toEqual(['Bug', 'x'.repeat(40)]);

    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(task(add('ten', 'draft', { tags: ten })).tags).toHaveLength(10);
    expect(task(add('dupes', 'draft', { tags: [...ten, 'T0', ' t1 '] })).tags).toHaveLength(10);
    expect(() => add('eleven', 'draft', { tags: [...ten, 'extra'] })).toThrow(ValidationError);
    expect(() => add('long', 'draft', { tags: ['x'.repeat(41)] })).toThrow(ValidationError);
  });

  it('treats blank milestones as null, trims, and clears with null on update', async () => {
    const { add, task, useCases } = await setupProject();
    expect(task(add('a', 'draft', { milestone: '   ' })).milestone).toBeNull();
    const id = add('b', 'draft', { milestone: '  M1 ' });
    expect(task(id).milestone).toBe('M1');
    expect(useCases.updateTask.execute(id, { milestone: '' }).milestone).toBeNull();
    useCases.updateTask.execute(id, { milestone: 'M2' });
    expect(useCases.updateTask.execute(id, { milestone: null }).milestone).toBeNull();
    useCases.updateTask.execute(id, { milestone: 'M3', tags: ['a'] });
    expect(useCases.updateTask.execute(id, {}).milestone).toBe('M3');
    expect(() => add('c', 'draft', { milestone: 'm'.repeat(500) })).toThrow(ValidationError);
  });

  it('does not persist a partial edit when the tags are invalid', async () => {
    const { add, task, useCases } = await setupProject();
    const id = add('orig', 'draft');
    expect(() => useCases.updateTask.execute(id, { title: 'changed', tags: ['x'.repeat(41)] })).toThrow(
      ValidationError,
    );
    expect(task(id).title).toBe('orig');
  });
});

describe('restart with a shared database (QA)', () => {
  it('a new container keeps drafts and queued tasks, fails interrupted ones and resumes the queue in order', async () => {
    const db = openDatabase(':memory:');
    const build = (runtime: FakeAgentRuntime) =>
      createContainer({
        db,
        runtime,
        instructionWriter: new FakeInstructionWriter(),
        ...fakeSkillSupport(),
        logger: { info: () => undefined, error: () => undefined },
        maxDelegationDepth: 4,
        reservedPorts: [],
      });
    let busyReached = false;
    const first = build(
      new FakeAgentRuntime({
        CTO: () => {
          busyReached = true;
          return new Promise<string>(() => undefined);
        },
      }),
    );
    const { cto, project } = await createTeamProject(
      { ...first, runtime: undefined, instructionWriter: undefined } as never,
      [],
    );
    const assign = (title: string, start: Start) =>
      first.useCases.assignTask.execute(project.id, { agentId: cto.id, title, description: 'D', start }).id;
    const busy = assign('busy', 'now');
    const draft = assign('draft', 'draft');
    const q1 = assign('q1', 'queue');
    const q2 = assign('q2', 'queue');
    // Wait until the old execution is parked so it cannot overwrite the row after the restart.
    await eventually(() => expect(busyReached).toBe(true));
    expect(first.useCases.getTask.execute(busy).status).toBe('running');

    const runtime = new FakeAgentRuntime({});
    const second = build(runtime);
    expect(second.recoverInterruptedTasks.execute()).toBe(1);
    const status = (id: string) => second.useCases.getTask.execute(id).status;
    expect([status(busy), status(draft), status(q1), status(q2)]).toEqual([
      'failed',
      'draft',
      'queued',
      'queued',
    ]);
    second.processTaskQueues();

    await eventually(() => expect([status(q1), status(q2)]).toEqual(['completed', 'completed']));
    expect(status(draft)).toBe('draft');
    expect(runtime.requests.map((r) => r.prompt)).toEqual([
      expect.stringContaining('q1'),
      expect.stringContaining('q2'),
    ]);
  });
});
