import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projectsApi';
import { queryKeys } from '../../api/queryKeys';

export const useProjects = () => useQuery({ queryKey: queryKeys.projects, queryFn: projectsApi.list });

export const useProject = (id: string) =>
  useQuery({ queryKey: queryKeys.project(id), queryFn: () => projectsApi.get(id) });

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useSetProjectMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberIds: string[]) => projectsApi.setMembers(projectId, memberIds),
    onSuccess: (project) => queryClient.setQueryData(queryKeys.project(projectId), project),
  });
}
