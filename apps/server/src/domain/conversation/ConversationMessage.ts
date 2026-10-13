import type { MessagePayload } from '@fleet/shared';

export interface ConversationMessage {
  id: string;
  taskId: string;
  seq: number;
  payload: MessagePayload;
  createdAt: Date;
}
