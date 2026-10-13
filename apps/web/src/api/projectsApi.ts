import type { ProjectDto, ProjectInput } from '@fleet/shared';
import { request } from './httpClient';

export const projectsApi = {
  list: () => request<ProjectDto[]>('/projects'),
  get: (id: string) => request<ProjectDto>(`/projects/${id}`),
  create: (input: ProjectInput) => request<ProjectDto>('/projects', { method: 'POST', body: input }),
  setMembers: (id: string, memberIds: string[]) =>
    request<ProjectDto>(`/projects/${id}/agents`, { method: 'PUT', body: { memberIds } }),
};
