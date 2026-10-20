import type { ProjectInput } from '@fleet/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projectsApi';
import { queryKeys } from '../../api/queryKeys';
import { useCurrentOrganization } from '../organizations/OrganizationContext';

export function useProjects() {
  const { id: organizationId } = useCurrentOrganization();
  return useQuery({
    queryKey: queryKeys.projects(organizationId),
    queryFn: () => projectsApi.list(organizationId),
  });
}

export const useProject = (id: string) =>
  useQuery({ queryKey: queryKeys.project(id), queryFn: () => projectsApi.get(id), enabled: id !== '' });

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { id: organizationId } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: ProjectInput) => projectsApi.create(organizationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects(organizationId) }),
  });
}

export function useSetProjectMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberIds: string[]) => projectsApi.setMembers(projectId, memberIds),
    onSuccess: (project) => queryClient.setQueryData(queryKeys.project(projectId), project),
  });
}

export function useSetProjectArchived(projectId: string) {
  const queryClient = useQueryClient();
  const { id: organizationId } = useCurrentOrganization();
  return useMutation({
    mutationFn: (archived: boolean) =>
      archived ? projectsApi.archive(projectId) : projectsApi.unarchive(projectId),
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(projectId), project);
      return queryClient.invalidateQueries({ queryKey: queryKeys.projects(organizationId) });
    },
  });
}

export function useProjectsTelemetry() {
  const { id: organizationId } = useCurrentOrganization();
  return useQuery({
    queryKey: queryKeys.projectsTelemetry(organizationId),
    queryFn: () => projectsApi.telemetry(organizationId),
  });
}

/** Re-queues the recoverable failed tasks of a project; callers must confirm with the user first. */
export function useResumeProject() {
  const queryClient = useQueryClient();
  const { id: organizationId } = useCurrentOrganization();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.resume(projectId),
    onSuccess: (_result, projectId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectsTelemetry(organizationId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects(organizationId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(projectId) }),
      ]),
  });
}
