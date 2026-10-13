export const MESSAGE_KINDS = [
  'user',
  'assistant_text',
  'tool_use',
  'tool_result',
  'system',
  'result',
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export type MessagePayload =
  | { kind: 'user'; text: string }
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_use'; toolUseId: string; toolName: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; content: string; isError: boolean }
  | { kind: 'system'; text: string }
  | { kind: 'result'; text: string; isError: boolean };

export interface ConversationMessageDto {
  id: string;
  taskId: string;
  seq: number;
  payload: MessagePayload;
  createdAt: string;
}
