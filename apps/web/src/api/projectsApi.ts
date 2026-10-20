import type { ProjectDto, ProjectInput, ProjectsTelemetryDto, ResumeProjectResultDto } from '@fleet/shared';
import { request } from './httpClient';

export const projectsApi = {
  list: (organizationId: string) => request<ProjectDto[]>(`/organizations/${organizationId}/projects`),
  telemetry: (organizationId: string) =>
    request<ProjectsTelemetryDto>(`/organizations/${organizationId}/projects/telemetry`),
  get: (id: string) => request<ProjectDto>(`/projects/${id}`),
  create: (organizationId: string, input: ProjectInput) =>
    request<ProjectDto>(`/organizations/${organizationId}/projects`, { method: 'POST', body: input }),
  setMembers: (id: string, memberIds: string[]) =>
    request<ProjectDto>(`/projects/${id}/agents`, { method: 'PUT', body: { memberIds } }),
  archive: (id: string) => request<ProjectDto>(`/projects/${id}/archive`, { method: 'POST' }),
  resume: (id: string) => request<ResumeProjectResultDto>(`/projects/${id}/resume`, { method: 'POST' }),
  unarchive: (id: string) => request<ProjectDto>(`/projects/${id}/unarchive`, { method: 'POST' }),
};
