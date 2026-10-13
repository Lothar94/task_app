import type { AgentInput } from '@fleet/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi, type InstructionsBrief } from '../../api/agentsApi';
import { queryKeys } from '../../api/queryKeys';

export const useAgents = () => useQuery({ queryKey: queryKeys.agents, queryFn: agentsApi.list });

export const useAgent = (id: string) =>
  useQuery({ queryKey: queryKeys.agent(id), queryFn: () => agentsApi.get(id) });

export interface SaveAgentCommand {
  id?: string;
  input: AgentInput;
  collaboratorIds: string[];
  instructionsGuidance: string;
}

async function saveAgent({ id, input, collaboratorIds, instructionsGuidance }: SaveAgentCommand) {
  if (!id) return agentsApi.create({ ...input, collaboratorIds, instructionsGuidance });
  await agentsApi.update(id, input);
  return agentsApi.setCollaborators(id, collaboratorIds);
}

export function useSaveAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
  });
}

export const useDraftInstructions = () =>
  useMutation({ mutationFn: (brief: InstructionsBrief) => agentsApi.draftInstructions(brief) });

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
  });
}
