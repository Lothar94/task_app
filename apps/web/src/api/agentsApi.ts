import type {
  AgentDto,
  AgentExportDto,
  AgentExportRequest,
  AgentImportRequest,
  AgentImportResultDto,
  AgentInput,
} from '@fleet/shared';
import { request } from './httpClient';

export interface InstructionsBrief {
  name: string;
  role: string;
  description: string;
  allowedTools: string[];
  skills: string[];
  collaboratorIds: string[];
  guidance: string;
}

export const agentsApi = {
  list: (organizationId: string) => request<AgentDto[]>(`/organizations/${organizationId}/agents`),
  get: (id: string) => request<AgentDto>(`/agents/${id}`),
  create: (
    organizationId: string,
    input: AgentInput & { collaboratorIds: string[]; instructionsGuidance: string },
  ) => request<AgentDto>(`/organizations/${organizationId}/agents`, { method: 'POST', body: input }),
  update: (id: string, input: AgentInput) =>
    request<AgentDto>(`/agents/${id}`, { method: 'PUT', body: input }),
  setCollaborators: (id: string, collaboratorIds: string[]) =>
    request<AgentDto>(`/agents/${id}/collaborators`, { method: 'PUT', body: { collaboratorIds } }),
  draftInstructions: (brief: InstructionsBrief) =>
    request<{ instructions: string }>('/agents/instructions-draft', { method: 'POST', body: brief }),
  export: (organizationId: string, exportRequest: AgentExportRequest) =>
    request<AgentExportDto>(`/organizations/${organizationId}/agents/export`, {
      method: 'POST',
      body: exportRequest,
    }),
  import: (organizationId: string, importRequest: AgentImportRequest) =>
    request<AgentImportResultDto>(`/organizations/${organizationId}/agents/import`, {
      method: 'POST',
      body: importRequest,
    }),
  remove: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),
};
