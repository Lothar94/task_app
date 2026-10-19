import type { ProjectDto } from '@fleet/shared';
import { useQueries } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasksApi';
import { type ProjectTelemetry, projectTelemetry } from './projectTelemetryModel';

export interface ProjectTelemetryState {
  isPending: boolean;
  /** Undefined while loading or when the task tree could not be fetched. */
  telemetry?: ProjectTelemetry;
}

/** Telemetry of each project, derived from its task tree (shares the cache with the project page). */
export function useProjectTelemetry(projects: ProjectDto[]): Map<string, ProjectTelemetryState> {
  return useQueries({
    queries: projects.map((project) => ({
      queryKey: queryKeys.taskTree(project.id),
      queryFn: () => tasksApi.tree(project.id),
    })),
    combine: (results) =>
      new Map(
        projects.map((project, index) => {
          const result = results[index];
          return [
            project.id,
            {
              isPending: result?.isPending ?? true,
              telemetry: result?.data && projectTelemetry(result.data),
            },
          ];
        }),
      ),
  });
}
