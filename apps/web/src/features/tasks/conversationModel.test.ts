import type { ConversationMessageDto, MessagePayload } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { buildTimeline, DELEGATE_TOOL, describeDelegation, shortToolName } from './conversationModel';

const message = (seq: number, payload: MessagePayload): ConversationMessageDto => ({
  id: `m${seq}`,
  taskId: 't1',
  seq,
  payload,
  createdAt: new Date(0).toISOString(),
});

describe('buildTimeline', () => {
  it('pairs tool calls with their results and keeps the rest in order', () => {
    const timeline = buildTimeline([
      message(1, { kind: 'user', text: 'Do it' }),
      message(2, { kind: 'tool_use', toolUseId: 'u1', toolName: 'Read', input: {} }),
      message(3, { kind: 'assistant_text', text: 'Reading' }),
      message(4, { kind: 'tool_result', toolUseId: 'u1', content: 'file', isError: false }),
    ]);

    expect(timeline.map((item) => item.type)).toEqual(['message', 'tool', 'message']);
    expect(timeline[1]).toMatchObject({ result: { content: 'file' } });
  });

  it('leaves calls without a result pending', () => {
    const [item] = buildTimeline([
      message(1, { kind: 'tool_use', toolUseId: 'u1', toolName: 'Bash', input: {} }),
    ]);
    expect(item).toMatchObject({ type: 'tool', result: null });
  });
});

describe('describeDelegation', () => {
  it('extracts collaborator, title and subtask id', () => {
    const call = {
      kind: 'tool_use' as const,
      toolUseId: 'u1',
      toolName: DELEGATE_TOOL,
      input: { collaborator: 'Backend', title: 'API' },
    };
    const result = {
      kind: 'tool_result' as const,
      toolUseId: 'u1',
      content: 'Subtask abc-1 (Task 4) assigned to …',
      isError: false,
    };
    expect(describeDelegation(call, result)).toEqual({
      collaborator: 'Backend',
      title: 'API',
      subtaskId: 'abc-1',
      subtaskNumber: 4,
    });
  });

  it('understands results recorded before tasks had numbers', () => {
    const call = { kind: 'tool_use' as const, toolUseId: 'u1', toolName: DELEGATE_TOOL, input: {} };
    const result = {
      kind: 'tool_result' as const,
      toolUseId: 'u1',
      content: 'Subtask abc-1 assigned',
      isError: false,
    };
    expect(describeDelegation(call, result)).toMatchObject({ subtaskId: 'abc-1', subtaskNumber: null });
  });

  it('ignores other tools', () => {
    expect(
      describeDelegation({ kind: 'tool_use', toolUseId: 'u', toolName: 'Read', input: {} }, null),
    ).toBeNull();
  });
});

describe('shortToolName', () => {
  it('strips the MCP prefix', () => {
    expect(shortToolName('mcp__fleet__report_result')).toBe('report_result');
    expect(shortToolName('Bash')).toBe('Bash');
  });
});
