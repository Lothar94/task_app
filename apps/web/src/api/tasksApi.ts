import type {
  AssignTaskInput,
  ConversationMessageDto,
  ReorderQueueInput,
  TaskDto,
  TaskExecutionDto,
  TaskGitContextDto,
  TaskGitDiffDto,
  TaskNodeDto,
  UpdateTaskInput,
} from '@fleet/shared';
import { request } from './httpClient';

export const tasksApi = {
  tree: (projectId: string) => request<TaskNodeDto[]>(`/projects/${projectId}/tasks`),
  assign: (projectId: string, input: AssignTaskInput) =>
    request<TaskDto>(`/projects/${projectId}/tasks`, { method: 'POST', body: input }),
  update: (id: string, input: UpdateTaskInput) =>
    request<TaskDto>(`/tasks/${id}`, { method: 'PATCH', body: input }),
  start: (id: string) => request<TaskDto>(`/tasks/${id}/start`, { method: 'POST' }),
  enqueue: (id: string) => request<TaskDto>(`/tasks/${id}/enqueue`, { method: 'POST' }),
  dequeue: (id: string) => request<TaskDto>(`/tasks/${id}/dequeue`, { method: 'POST' }),
  reorderQueue: (projectId: string, input: ReorderQueueInput) =>
    request<TaskDto[]>(`/projects/${projectId}/queue`, { method: 'PUT', body: input }),
  get: (id: string) => request<TaskDto>(`/tasks/${id}`),
  conversation: (id: string) => request<ConversationMessageDto[]>(`/tasks/${id}/conversation`),
  followUp: (id: string, message: string) =>
    request<TaskDto>(`/tasks/${id}/messages`, { method: 'POST', body: { message } }),
  execution: (id: string) => request<TaskExecutionDto>(`/tasks/${id}/execution`),
  git: (id: string) => request<TaskGitContextDto>(`/tasks/${id}/git`),
  gitDiff: (id: string) => request<TaskGitDiffDto>(`/tasks/${id}/git/diff`),
  cancel: (id: string) => request<void>(`/tasks/${id}/cancel`, { method: 'POST' }),
};
