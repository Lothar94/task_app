import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '../../api/organizationsApi';
import { queryKeys } from '../../api/queryKeys';

export const useOrganizations = () =>
  useQuery({ queryKey: queryKeys.organizations, queryFn: organizationsApi.list });

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: organizationsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations }),
  });
}

export function useRenameOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => organizationsApi.rename(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations }),
  });
}
