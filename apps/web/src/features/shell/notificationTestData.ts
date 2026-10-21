import type { FleetEvent, TaskDto } from '@fleet/shared';

export const taskOf = (patch: Partial<TaskDto> = {}): TaskDto => ({
  id: 't1',
  number: 7,
  projectId: 'p1',
  parentTaskId: null,
  agentId: 'a1',
  proposedByAgentId: null,
  title: 'Migrar login',
  description: '',
  status: 'running',
  resultSummary: null,
  milestone: null,
  tags: [],
  queuePosition: null,
  createdAt: '2026-10-21T08:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  ...patch,
});

export const updated = (patch: Partial<TaskDto> = {}): FleetEvent => {
  const task = taskOf(patch);
  return { type: 'task.updated', projectId: task.projectId, task };
};

export const created = (patch: Partial<TaskDto> = {}): FleetEvent => {
  const task = taskOf(patch);
  return { type: 'task.created', projectId: task.projectId, task };
};
