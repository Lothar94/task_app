import type { AgentInput } from '@fleet/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi, type InstructionsBrief } from '../../api/agentsApi';
import { skillsApi } from '../../api/skillsApi';
import { queryKeys } from '../../api/queryKeys';
import { useCurrentOrganization } from '../organizations/OrganizationContext';

export function useAgents() {
  const { id: organizationId } = useCurrentOrganization();
  return useQuery({
    queryKey: queryKeys.agents(organizationId),
    queryFn: () => agentsApi.list(organizationId),
  });
}

export const useSkills = () => useQuery({ queryKey: queryKeys.skills, queryFn: skillsApi.list });

export const useAgent = (id: string) =>
  useQuery({ queryKey: queryKeys.agent(id), queryFn: () => agentsApi.get(id), enabled: id !== '' });

export interface SaveAgentCommand {
  id?: string;
  input: AgentInput;
  collaboratorIds: string[];
  instructionsGuidance: string;
}

async function saveAgent(
  organizationId: string,
  { id, input, collaboratorIds, instructionsGuidance }: SaveAgentCommand,
) {
  if (!id) return agentsApi.create(organizationId, { ...input, collaboratorIds, instructionsGuidance });
  await agentsApi.update(id, input);
  return agentsApi.setCollaborators(id, collaboratorIds);
}

export function useSaveAgent() {
  const queryClient = useQueryClient();
  const { id: organizationId } = useCurrentOrganization();
  return useMutation({
    mutationFn: (command: SaveAgentCommand) => saveAgent(organizationId, command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents(organizationId) }),
  });
}

export const useDraftInstructions = () =>
  useMutation({ mutationFn: (brief: InstructionsBrief) => agentsApi.draftInstructions(brief) });

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const { id: organizationId } = useCurrentOrganization();
  return useMutation({
    mutationFn: agentsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents(organizationId) }),
  });
}
