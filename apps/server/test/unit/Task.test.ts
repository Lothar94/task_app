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

  it('requires a title and a description', () => {
    expect(() =>
      Task.create(
        't',
        { projectId: 'p', number: 1, parentTaskId: null, agentId: 'a', title: ' ', description: 'x' },
        now,
      ),
    ).toThrow(ValidationError);
  });
});
