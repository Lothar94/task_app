import type { ConversationMessageDto, MessagePayload } from '@fleet/shared';

type Payload<K extends MessagePayload['kind']> = Extract<MessagePayload, { kind: K }>;

export const DELEGATE_TOOL = 'mcp__fleet__delegate_task';

export type TimelineItem =
  | {
      type: 'message';
      id: string;
      payload: Exclude<MessagePayload, Payload<'tool_use'> | Payload<'tool_result'>>;
      /** True only for the first user message: the prompt the server generated for the agent. */
      isInitialPrompt: boolean;
    }
  | { type: 'tool'; id: string; call: Payload<'tool_use'>; result: Payload<'tool_result'> | null };

/** Groups each tool call with its result so the conversation reads as a sequence of steps. */
export function buildTimeline(messages: ConversationMessageDto[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let initialPromptSeen = false;
  const toolItems = new Map<string, Extract<TimelineItem, { type: 'tool' }>>();

  for (const { id, payload } of messages) {
    if (payload.kind === 'tool_use') {
      const item = { type: 'tool' as const, id, call: payload, result: null };
      toolItems.set(payload.toolUseId, item);
      items.push(item);
    } else if (payload.kind === 'tool_result') {
      const item = toolItems.get(payload.toolUseId);
      if (item) item.result = payload;
    } else {
      const isInitialPrompt = payload.kind === 'user' && !initialPromptSeen;
      if (isInitialPrompt) initialPromptSeen = true;
      items.push({ type: 'message', id, payload, isInitialPrompt });
    }
  }
  return items;
}

export const hasDescription = (text: string): boolean => text.trim().length > 0;

export function shortToolName(toolName: string): string {
  return toolName.replace(/^mcp__[^_]+__/, '');
}

export interface DelegationSummary {
  collaborator: string;
  title: string;
  subtaskId: string | null;
  subtaskNumber: number | null;
}

/** The delegate tool answers "Subtask <id> (Task <number>) assigned to …". */
function parseSubtaskReference(result: Payload<'tool_result'> | null) {
  const match = result ? /Subtask (\S+)(?: \(Task (\d+)\))?/.exec(result.content) : null;
  return {
    subtaskId: match?.[1] ?? null,
    subtaskNumber: match?.[2] ? Number(match[2]) : null,
  };
}

export function describeDelegation(
  call: Payload<'tool_use'>,
  result: Payload<'tool_result'> | null,
): DelegationSummary | null {
  if (call.toolName !== DELEGATE_TOOL) return null;
  const input = (call.input ?? {}) as { collaborator?: string; title?: string };
  return {
    collaborator: input.collaborator ?? '?',
    title: input.title ?? '',
    ...parseSubtaskReference(result),
  };
}
