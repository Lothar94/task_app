import type { MessagePayload } from '@fleet/shared';
import type { ConversationMessage } from '../../domain/conversation/ConversationMessage.js';

export interface ConversationRepository {
  append(taskId: string, payload: MessagePayload): ConversationMessage;
  findByTask(taskId: string): ConversationMessage[];
}
