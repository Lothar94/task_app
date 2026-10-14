import type { OrganizationDto, OrganizationInput } from '@fleet/shared';
import { request } from './httpClient';

export const organizationsApi = {
  list: () => request<OrganizationDto[]>('/organizations'),
  get: (id: string) => request<OrganizationDto>(`/organizations/${id}`),
  create: (input: OrganizationInput) =>
    request<OrganizationDto>('/organizations', { method: 'POST', body: input }),
  rename: (id: string, input: OrganizationInput) =>
    request<OrganizationDto>(`/organizations/${id}`, { method: 'PUT', body: input }),
};
