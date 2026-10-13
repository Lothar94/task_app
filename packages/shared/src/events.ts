import type { ConversationMessageDto } from './conversation.js';
import type { TaskDto } from './tasks.js';

export type FleetEvent =
  | { type: 'task.created'; projectId: string; task: TaskDto }
  | { type: 'task.updated'; projectId: string; task: TaskDto }
  | { type: 'task.message_appended'; projectId: string; message: ConversationMessageDto };
