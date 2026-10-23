import type { ConversationMessageDto } from './conversation.js';
import type { AgentActivityDto } from './fleetActivity.js';
import type { TaskDto } from './tasks.js';

/**
 * Events streamed by GET /api/events (Server-Sent Events, one JSON FleetEvent per `data:` line).
 * Filters (optional, combinable): `projectId` keeps the events of that project; `organizationId`
 * keeps the events of the projects of that organization (the shell's notification center uses it).
 * `agent.activity` belongs to no project: it passes the `organizationId` filter of its organization
 * and an unfiltered connection, never a `projectId` filter. Consumers must ignore unknown types.
 */
export type FleetEvent =
  | { type: 'task.created'; projectId: string; task: TaskDto }
  | { type: 'task.updated'; projectId: string; task: TaskDto }
  | { type: 'task.message_appended'; projectId: string; message: ConversationMessageDto }
  /** Full live snapshot of an organization's agents, sent (coalesced) after its tasks change. */
  | { type: 'agent.activity'; organizationId: string; activity: AgentActivityDto };
