import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../src/domain/errors/DomainError.js';
import { Task } from '../../src/domain/task/Task.js';

const now = new Date('2026-01-01T00:00:00Z');
const newTask = () =>
  Task.create(
    't1',
    { projectId: 'p1', number: 1, parentTaskId: null, agentId: 'a1', title: 'Build', description: 'Do it' },
    now,
  );

describe('Task', () => {
  it('starts pending and runs until completed with the reported summary', () => {
    const task = newTask();
    expect(task.status).toBe('pending');
    task.start(now);
    task.reportResult('All done');
    task.complete('fallback', now);
    expect(task.status).toBe('completed');
    expect(task.resultSummary).toBe('All done');
  });

  it('uses the fallback summary when the agent did not report one', () => {
    const task = newTask();
    task.start(now);
    task.complete('final message', now);
    expect(task.resultSummary).toBe('final message');
  });

  it('waits for subtasks only while running and tolerates parallel delegations', () => {
    const task = newTask();
    expect(() => task.waitForSubtasks()).toThrow(ConflictError);
    task.start(now);
    task.waitForSubtasks();
    task.waitForSubtasks();
    expect(task.status).toBe('waiting_subtasks');
    task.resumeAfterSubtasks();
    expect(task.status).toBe('running');
  });

  it('cannot start twice while active', () => {
    const task = newTask();
    task.start(now);
    expect(() => task.start(now)).toThrow(ConflictError);
  });

  it('accepts follow-ups only once stopped and with a session', () => {
    const task = newTask();
    task.start(now);
    expect(() => task.prepareFollowUp()).toThrow(ConflictError);
    task.complete('done', now);
    expect(() => task.prepareFollowUp()).toThrow(/no conversation/);
    task.attachSession('s1');
    task.prepareFollowUp();
    expect(task.resultSummary).toBeNull();
  });

  describe('requeue', () => {
    const failedTask = (parentTaskId: string | null = null) => {
      const task = Task.create(
        't',
        { projectId: 'p', number: 1, parentTaskId, agentId: 'a', title: 'T', description: 'x' },
        now,
      );
      task.start(now);
      task.fail('usage limit reached', now);
      return task;
    };

    it('moves a failed root task back to the queue and clears its failure', () => {
      const task = failedTask();
      task.requeue(3);
      expect(task.toSnapshot()).toMatchObject({
        status: 'queued',
        queuePosition: 3,
        resultSummary: null,
        finishedAt: null,
      });
    });

    it('rejects tasks that are not failed', () => {
      const task = newTask();
      expect(() => task.requeue(1)).toThrow(ConflictError);
      task.start(now);
      task.complete('done', now);
      expect(() => task.requeue(1)).toThrow(ConflictError);
    });

    it('rejects failed subtasks', () => {
      expect(() => failedTask('parent').requeue(1)).toThrow(ConflictError);
    });
  });

  it('requires a title and a description', () => {
    expect(() =>
      Task.create(
        't',
        { projectId: 'p', number: 1, parentTaskId: null, agentId: 'a', title: ' ', description: 'x' },
        now,
      ),
    ).toThrow(ValidationError);
  });

  describe('proposed tasks', () => {
    const base = { projectId: 'p1', number: 1, agentId: 'a1', title: 'Build', description: 'Do it' };

    it('defaults to no proposer and keeps the proposer of top-level tasks', () => {
      expect(newTask().proposedByAgentId).toBeNull();
      const proposed = Task.createDraft('t2', { ...base, parentTaskId: null, proposedByAgentId: 'a2' }, now);
      expect(proposed.proposedByAgentId).toBe('a2');
      expect(proposed.toSnapshot().proposedByAgentId).toBe('a2');
    });

    it('rejects a proposer on subtasks', () => {
      expect(() =>
        Task.createDraft('t2', { ...base, parentTaskId: 't1', proposedByAgentId: 'a2' }, now),
      ).toThrow(ValidationError);
    });
  });

  describe('planning', () => {
    const draft = (extra: Partial<Parameters<typeof Task.createDraft>[1]> = {}) =>
      Task.createDraft(
        't1',
        {
          projectId: 'p1',
          number: 1,
          parentTaskId: null,
          agentId: 'a1',
          title: 'Build',
          description: 'Do it',
          ...extra,
        },
        now,
      );

    it('creates drafts that are neither active nor finished', () => {
      const task = draft();
      expect(task.status).toBe('draft');
      expect([task.isPlanned, task.isActive, task.isFinished]).toEqual([true, false, false]);
      expect(task.queuePosition).toBeNull();
    });

    it('moves between draft and queued keeping the position only while queued', () => {
      const task = draft();
      expect(() => task.dequeue()).toThrow(ConflictError);
      expect(() => task.moveInQueue(1)).toThrow(ConflictError);
      task.enqueue(2);
      expect([task.status, task.queuePosition]).toEqual(['queued', 2]);
      expect(() => task.enqueue(3)).toThrow(ConflictError);
      task.moveInQueue(1);
      expect(task.queuePosition).toBe(1);
      task.dequeue();
      expect([task.status, task.queuePosition]).toEqual(['draft', null]);
    });

    it.each(['draft', 'queued'] as const)('starts from %s clearing the queue position', (from) => {
      const task = draft();
      if (from === 'queued') task.enqueue(1);
      task.start(now);
      expect([task.status, task.queuePosition, task.isActive]).toEqual(['running', null, true]);
    });

    it('cancels planned tasks clearing the queue position', () => {
      const task = draft();
      task.enqueue(1);
      task.cancel(now);
      expect([task.status, task.queuePosition]).toEqual(['cancelled', null]);
    });

    it('cannot enqueue a task that is not a draft', () => {
      const task = newTask();
      expect(() => task.enqueue(1)).toThrow(ConflictError);
    });

    it('edits title, description and agent only while planned', () => {
      const task = draft();
      task.edit({ title: ' New ', agentId: 'a2' });
      expect([task.title, task.description, task.agentId]).toEqual(['New', 'Do it', 'a2']);
      expect(() => task.edit({ title: ' ' })).toThrow(ValidationError);
      task.start(now);
      expect(() => task.edit({ title: 'Late' })).toThrow(ConflictError);
    });

    it('retags at any time and leaves omitted fields untouched', () => {
      const task = draft({ milestone: 'M1', tags: ['a'] });
      task.start(now);
      task.complete('ok', now);
      task.retag(undefined, ['b']);
      expect([task.milestone, task.tags]).toEqual(['M1', ['b']]);
      task.retag(null, undefined);
      expect([task.milestone, task.tags]).toEqual([null, ['b']]);
    });

    it('normalizes the milestone', () => {
      expect(draft({ milestone: '  Beta  ' }).milestone).toBe('Beta');
      expect(draft({ milestone: '   ' }).milestone).toBeNull();
      expect(() => draft({ milestone: 'x'.repeat(81) })).toThrow(ValidationError);
    });

    it('normalizes tags: trims, drops empties and case-insensitive duplicates', () => {
      expect(draft({ tags: [' API ', '', 'api', 'Db', '  '] }).tags).toEqual(['API', 'Db']);
    });

    it('enforces tag limits', () => {
      expect(() => draft({ tags: ['x'.repeat(41)] })).toThrow(ValidationError);
      expect(draft({ tags: ['x'.repeat(40)] }).tags).toHaveLength(1);
      const eleven = Array.from({ length: 11 }, (_, index) => `t${index}`);
      expect(() => draft({ tags: eleven })).toThrow(ValidationError);
      expect(draft({ tags: eleven.slice(0, 10) }).tags).toHaveLength(10);
    });
  });

  describe('modelChoice', () => {
    const withChoice = (modelChoice: unknown) =>
      Task.create(
        't1',
        {
          projectId: 'p1',
          number: 1,
          parentTaskId: null,
          agentId: 'a1',
          title: 'Build',
          description: 'Do it',
          modelChoice,
        } as never,
        now,
      );

    it('defaults to no choice and keeps valid values', () => {
      expect(newTask().modelChoice).toEqual({ model: null, effort: null });
      expect(withChoice({ model: 'haiku', effort: null }).modelChoice).toEqual({ model: 'haiku', effort: null });
    });

    it.each([{ model: 'gpt-4', effort: null }, { model: null, effort: 'ultra' }, { model: 42, effort: null }])(
      'rejects invalid choice %o',
      (choice) => {
        expect(() => withChoice(choice)).toThrow(ValidationError);
      },
    );
  });
});
