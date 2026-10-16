import { TASK_LIMITS, type TaskStatus } from '@fleet/shared';
import { ConflictError, ValidationError } from '../errors/DomainError.js';
import { requireIntegerInRange, requireText } from '../shared/guards.js';

const requirePositiveInteger = (value: number) =>
  requireIntegerInRange(value, 'number', 1, Number.MAX_SAFE_INTEGER);

const FINISHED_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'cancelled'];
const PLANNED_STATUSES: readonly TaskStatus[] = ['draft', 'queued'];

function normalizeMilestone(milestone: string | null | undefined): string | null {
  const trimmed = milestone?.trim() ?? '';
  if (trimmed.length > TASK_LIMITS.milestoneLength) {
    throw new ValidationError(`milestone must be at most ${TASK_LIMITS.milestoneLength} characters`);
  }
  return trimmed || null;
}

function normalizeTags(tags: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim();
    if (tag.length === 0 || seen.has(tag.toLowerCase())) continue;
    if (tag.length > TASK_LIMITS.tagLength) {
      throw new ValidationError(`each tag must be at most ${TASK_LIMITS.tagLength} characters`);
    }
    seen.add(tag.toLowerCase());
    result.push(tag);
  }
  if (result.length > TASK_LIMITS.maxTags) {
    throw new ValidationError(`a task can have at most ${TASK_LIMITS.maxTags} tags`);
  }
  return result;
}

export interface NewTask {
  projectId: string;
  /** Sequential identifier within the project, shared by tasks and subtasks. */
  number: number;
  parentTaskId: string | null;
  agentId: string;
  title: string;
  description: string;
  milestone?: string | null;
  tags?: string[];
  /** Agent that proposed the task on its own; only top-level tasks can be proposed. */
  proposedByAgentId?: string | null;
}

export interface TaskSnapshot extends Omit<NewTask, 'milestone' | 'tags' | 'proposedByAgentId'> {
  id: string;
  status: TaskStatus;
  milestone: string | null;
  proposedByAgentId: string | null;
  tags: string[];
  queuePosition: number | null;
  resultSummary: string | null;
  sessionId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export class Task {
  private constructor(private state: TaskSnapshot) {}

  static create(id: string, task: NewTask, now: Date, status: 'pending' | 'draft' = 'pending'): Task {
    const proposedByAgentId = task.proposedByAgentId ?? null;
    if (proposedByAgentId && task.parentTaskId) {
      throw new ValidationError('A proposed task must be top-level, not a subtask');
    }
    return new Task({
      ...task,
      id,
      number: requirePositiveInteger(task.number),
      title: requireText(task.title, 'title', TASK_LIMITS.titleLength),
      description: requireText(task.description, 'description'),
      milestone: normalizeMilestone(task.milestone),
      tags: normalizeTags(task.tags),
      proposedByAgentId,
      queuePosition: null,
      status,
      resultSummary: null,
      sessionId: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
    });
  }

  static createDraft(id: string, task: NewTask, now: Date): Task {
    return Task.create(id, task, now, 'draft');
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

  get proposedByAgentId(): string | null {
    return this.state.proposedByAgentId;
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

  /** Draft or queued: defined by the project manager but not started yet. */
  get isPlanned(): boolean {
    return PLANNED_STATUSES.includes(this.state.status);
  }

  /** Pending, running or waiting for subtasks. */
  get isActive(): boolean {
    return !this.isPlanned && !this.isFinished;
  }

  get milestone(): string | null {
    return this.state.milestone;
  }

  get tags(): string[] {
    return [...this.state.tags];
  }

  get queuePosition(): number | null {
    return this.state.queuePosition;
  }

  start(now: Date): void {
    if (this.state.status !== 'pending' && !this.isPlanned && !this.isFinished) {
      throw new ConflictError(`Task "${this.state.id}" is already running`);
    }
    this.state = {
      ...this.state,
      queuePosition: null,
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

  enqueue(position: number): void {
    this.requireStatus('draft', 'queued');
    this.state = { ...this.state, status: 'queued', queuePosition: requirePositiveInteger(position) };
  }

  dequeue(): void {
    this.requireQueued();
    this.state = { ...this.state, status: 'draft', queuePosition: null };
  }

  moveInQueue(position: number): void {
    this.requireQueued();
    this.state = { ...this.state, queuePosition: requirePositiveInteger(position) };
  }

  /** Changes what the agent will be asked to do; only possible before the task starts. */
  edit(changes: { title?: string; description?: string; agentId?: string }): void {
    if (!this.isPlanned) {
      throw new ConflictError(
        'Title, description and agent can only change while the task is a draft or queued',
      );
    }
    this.state = {
      ...this.state,
      title:
        changes.title === undefined
          ? this.state.title
          : requireText(changes.title, 'title', TASK_LIMITS.titleLength),
      description:
        changes.description === undefined
          ? this.state.description
          : requireText(changes.description, 'description'),
      agentId: changes.agentId ?? this.state.agentId,
    };
  }

  retag(milestone: string | null | undefined, tags: readonly string[] | undefined): void {
    this.state = {
      ...this.state,
      milestone: milestone === undefined ? this.state.milestone : normalizeMilestone(milestone),
      tags: tags === undefined ? this.state.tags : normalizeTags(tags),
    };
  }

  cancel(now: Date): void {
    if (this.isFinished) return;
    this.state = { ...this.state, queuePosition: null };
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

  private requireQueued(): void {
    if (this.state.status !== 'queued') {
      throw new ConflictError(`Task "${this.state.id}" is not queued`);
    }
  }

  private requireStatus(expected: TaskStatus, transition: string): void {
    if (this.state.status !== expected) {
      throw new ConflictError(
        `Cannot move task "${this.state.id}" from ${this.state.status} to ${transition}`,
      );
    }
  }
}
