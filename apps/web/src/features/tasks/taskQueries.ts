import type { AssignTaskInput } from '@fleet/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasksApi';

export const useTaskTree = (projectId: string) =>
  useQuery({ queryKey: queryKeys.taskTree(projectId), queryFn: () => tasksApi.tree(projectId) });

export const useTask = (id: string) =>
  useQuery({ queryKey: queryKeys.task(id), queryFn: () => tasksApi.get(id) });

export const useConversation = (taskId: string) =>
  useQuery({ queryKey: queryKeys.conversation(taskId), queryFn: () => tasksApi.conversation(taskId) });

export function useAssignTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTaskInput) => tasksApi.assign(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(projectId) }),
  });
}

export const useFollowUp = (taskId: string) =>
  useMutation({ mutationFn: (message: string) => tasksApi.followUp(taskId, message) });

export const useCancelTask = () => useMutation({ mutationFn: tasksApi.cancel });
