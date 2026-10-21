export const queryKeys = {
  organizations: ['organizations'] as const,
  agents: (organizationId: string) => ['agents', organizationId] as const,
  skills: ['skills'] as const,
  agent: (id: string) => ['agent', id] as const,
  projects: (organizationId: string) => ['projects', organizationId] as const,
  projectsTelemetry: (organizationId: string) => ['projects-telemetry', organizationId] as const,
  project: (id: string) => ['project', id] as const,
  taskTree: (projectId: string) => ['task-tree', projectId] as const,
  task: (id: string) => ['tasks', id] as const,
  execution: (taskId: string) => ['execution', taskId] as const,
  git: (taskId: string) => ['git', taskId] as const,
  gitDiff: (taskId: string) => ['git-diff', taskId] as const,
  conversation: (taskId: string) => ['conversation', taskId] as const,
  /** Prefix of every dashboard query, whatever its filters. */
  dashboards: ['dashboard'] as const,
  dashboard: (organizationId: string, projectId: string | null, days: number | null) =>
    ['dashboard', organizationId, projectId, days] as const,
  search: (organizationId: string, query: string) => ['search', organizationId, query] as const,
  fleetStatus: (organizationId: string) => ['fleet-status', organizationId] as const,
};
