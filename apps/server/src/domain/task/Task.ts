import type { TaskStatus } from '@fleet/shared';
import { ConflictError } from '../errors/DomainError.js';
import { requireIntegerInRange, requireText } from '../shared/guards.js';

const requirePositiveInteger = (value: number) =>
  requireIntegerInRange(value, 'number', 1, Number.MAX_SAFE_INTEGER);

const FINISHED_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'cancelled'];

export interface NewTask {
  projectId: string;
  /** Sequential identifier within the project, shared by tasks and subtasks. */
  number: number;
  parentTaskId: string | null;
  agentId: string;
  title: string;
  description: string;
}

export interface TaskSnapshot extends NewTask {
  id: string;
  status: TaskStatus;
  resultSummary: string | null;
  sessionId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export class Task {
  private constructor(private state: TaskSnapshot) {}

  static create(id: string, task: NewTask, now: Date): Task {
    return new Task({
      ...task,
      id,
      number: requirePositiveInteger(task.number),
      title: requireText(task.title, 'title', 200),
      description: requireText(task.description, 'description'),
      status: 'pending',
      resultSummary: null,
      sessionId: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
    });
  }

  static restore(snapshot: TaskSnapshot): Task {
    return new Task({ ...snapshot });
  }

  get id(): string {
    return this.state.id;
  }

  get number(): number {
    return this.state.number;
  }

  get projectId(): string {
    return this.state.projectId;
  }

  get parentTaskId(): string | null {
    return this.state.parentTaskId;
  }

  get agentId(): string {
    return this.state.agentId;
  }

  get title(): string {
    return this.state.title;
  }

  get description(): string {
    return this.state.description;
  }

  get status(): TaskStatus {
    return this.state.status;
  }

  get sessionId(): string | null {
    return this.state.sessionId;
  }

  get resultSummary(): string | null {
    return this.state.resultSummary;
  }

  get isFinished(): boolean {
    return FINISHED_STATUSES.includes(this.state.status);
  }

  get isActive(): boolean {
    return !this.isFinished;
  }

  start(now: Date): void {
    if (this.state.status !== 'pending' && !this.isFinished) {
      throw new ConflictError(`Task "${this.state.id}" is already running`);
    }
    this.state = {
      ...this.state,
      status: 'running',
      startedAt: this.state.startedAt ?? now,
      finishedAt: null,
    };
  }

  attachSession(sessionId: string): void {
    this.state = { ...this.state, sessionId };
  }

  waitForSubtasks(): void {
    if (this.state.status === 'waiting_subtasks') return;
    this.requireStatus('running', 'waiting_subtasks');
    this.state = { ...this.state, status: 'waiting_subtasks' };
  }

  resumeAfterSubtasks(): void {
    if (this.state.status !== 'waiting_subtasks') return;
    this.state = { ...this.state, status: 'running' };
  }

  reportResult(summary: string): void {
    this.state = { ...this.state, resultSummary: requireText(summary, 'summary') };
  }

  complete(fallbackSummary: string, now: Date): void {
    this.finish('completed', now, this.state.resultSummary ?? fallbackSummary);
  }

  fail(reason: string, now: Date): void {
    this.finish('failed', now, reason);
  }

  cancel(now: Date): void {
    if (this.isFinished) return;
    this.finish('cancelled', now, this.state.resultSummary ?? 'Cancelled by the project manager');
  }

  prepareFollowUp(): void {
    if (!this.isFinished) {
      throw new ConflictError('Follow-up messages can only be sent once the task has stopped');
    }
    if (!this.state.sessionId) {
      throw new ConflictError('The task has no conversation to resume');
    }
    this.state = { ...this.state, resultSummary: null };
  }

  toSnapshot(): TaskSnapshot {
    return { ...this.state };
  }

  private finish(status: TaskStatus, now: Date, summary: string): void {
    this.state = { ...this.state, status, resultSummary: summary, finishedAt: now };
  }

  private requireStatus(expected: TaskStatus, transition: string): void {
    if (this.state.status !== expected) {
      throw new ConflictError(
        `Cannot move task "${this.state.id}" from ${this.state.status} to ${transition}`,
      );
    }
  }
}
