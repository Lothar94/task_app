import type { ConversationMessageDto } from './conversation.js';
import type { TaskDto } from './tasks.js';

/**
 * Events streamed by GET /api/events (Server-Sent Events, one JSON FleetEvent per `data:` line).
 * Filters (optional, combinable): `projectId` keeps the events of that project; `organizationId`
 * keeps the events of the projects of that organization (the shell's notification center uses it).
 */
export type FleetEvent =
  | { type: 'task.created'; projectId: string; task: TaskDto }
  | { type: 'task.updated'; projectId: string; task: TaskDto }
  | { type: 'task.message_appended'; projectId: string; message: ConversationMessageDto };
