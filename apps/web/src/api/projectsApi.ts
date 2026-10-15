import type { ProjectDto, ProjectInput } from '@fleet/shared';
import { request } from './httpClient';

export const projectsApi = {
  list: (organizationId: string) => request<ProjectDto[]>(`/organizations/${organizationId}/projects`),
  get: (id: string) => request<ProjectDto>(`/projects/${id}`),
  create: (organizationId: string, input: ProjectInput) =>
    request<ProjectDto>(`/organizations/${organizationId}/projects`, { method: 'POST', body: input }),
  setMembers: (id: string, memberIds: string[]) =>
    request<ProjectDto>(`/projects/${id}/agents`, { method: 'PUT', body: { memberIds } }),
  archive: (id: string) => request<ProjectDto>(`/projects/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) => request<ProjectDto>(`/projects/${id}/unarchive`, { method: 'POST' }),
};
