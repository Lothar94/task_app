import type { AssignTaskInput, ConversationMessageDto, TaskDto, TaskNodeDto } from '@fleet/shared';
import { request } from './httpClient';

export const tasksApi = {
  tree: (projectId: string) => request<TaskNodeDto[]>(`/projects/${projectId}/tasks`),
  assign: (projectId: string, input: AssignTaskInput) =>
    request<TaskDto>(`/projects/${projectId}/tasks`, { method: 'POST', body: input }),
  get: (id: string) => request<TaskDto>(`/tasks/${id}`),
  conversation: (id: string) => request<ConversationMessageDto[]>(`/tasks/${id}/conversation`),
  followUp: (id: string, message: string) =>
    request<TaskDto>(`/tasks/${id}/messages`, { method: 'POST', body: { message } }),
  cancel: (id: string) => request<void>(`/tasks/${id}/cancel`, { method: 'POST' }),
};
