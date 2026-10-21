import type { TaskStatus } from './tasks.js';

/**
 * Global search of the shell (⌘K / Ctrl+K), resolved on the server so the browser does not have to
 * download every task of every project of the organization.
 *
 * GET /api/organizations/:id/search?q=<text>&limit=<n>
 * - `q` is trimmed; an empty query answers empty groups. Max length SEARCH_LIMITS.queryLength (longer → 400 VALIDATION).
 * - Matching is case- and accent-insensitive "contains" on names, titles and agent roles.
 * - A numeric query ("61", "#61", "tarea 61") also matches tasks by their per-project number.
 * - `limit` caps each group (default SEARCH_LIMITS.defaultPerGroup, max SEARCH_LIMITS.maxPerGroup).
 * - Order: exact matches first (task number, exact name), then prefix matches, then the rest;
 *   ties by most recent first.
 * - 404 when the organization does not exist.
 */
export const SEARCH_LIMITS = { queryLength: 200, defaultPerGroup: 5, maxPerGroup: 20 } as const;

export interface ProjectSearchHit {
  id: string;
  name: string;
  archived: boolean;
}

export interface TaskSearchHit {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  projectId: string;
  projectName: string;
}

export interface AgentSearchHit {
  id: string;
  name: string;
  role: string;
}

export interface SearchResultsDto {
  query: string;
  projects: ProjectSearchHit[];
  tasks: TaskSearchHit[];
  agents: AgentSearchHit[];
}

/**
 * Status bar of the shell.
 *
 * GET /api/organizations/:id/fleet-status → FleetStatusDto (404 when the organization does not exist).
 * The client measures the API latency itself as the round trip of this request.
 */
export const FLEET_STATES = [
  /** At least one agent of the organization is working on a task. */
  'active',
  /** No task is running or waiting for subtasks. */
  'idle',
] as const;
export type FleetState = (typeof FLEET_STATES)[number];

/** An agent with work in progress: its load is the number of its tasks running or waiting subtasks. */
export interface FleetNodeDto {
  agentId: string;
  name: string;
  activeTasks: number;
}

export interface FleetStatusDto {
  state: FleetState;
  /** Agents with at least one active task, most loaded first (ties by name). */
  activeNodes: FleetNodeDto[];
  totalAgents: number;
  /** Tasks of the organization running or waiting for subtasks. */
  activeTasks: number;
  /** Version of the app (server package version). */
  version: string;
  generatedAt: string;
}
