import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { RunUsage, RuntimeEvent } from '../../../application/ports/AgentRuntime.js';

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

/** Translates Claude Agent SDK messages into runtime-neutral events. */
export class SdkMessageMapper {
  map(message: SDKMessage): RuntimeEvent[] {
    switch (message.type) {
      case 'system':
        return message.subtype === 'init'
          ? [
              { type: 'session_started', sessionId: message.session_id },
              {
                type: 'message',
                payload: { kind: 'system', text: `Session started with model ${message.model}` },
              },
            ]
          : [];
      case 'assistant':
        return this.blocksOf(message.message.content).flatMap((block) => this.assistantBlock(block));
      case 'user':
        return this.blocksOf(message.message.content).flatMap((block) => this.toolResultBlock(block));
      case 'result':
        return this.result(message);
      default:
        return [];
    }
  }

  private assistantBlock(block: ContentBlock): RuntimeEvent[] {
    if (block.type === 'text' && block.text?.trim()) {
      return [{ type: 'message', payload: { kind: 'assistant_text', text: block.text } }];
    }
    if (block.type === 'tool_use' && block.id && block.name) {
      return [
        {
          type: 'message',
          payload: { kind: 'tool_use', toolUseId: block.id, toolName: block.name, input: block.input },
        },
      ];
    }
    return [];
  }

  private toolResultBlock(block: ContentBlock): RuntimeEvent[] {
    if (block.type !== 'tool_result' || !block.tool_use_id) return [];
    return [
      {
        type: 'message',
        payload: {
          kind: 'tool_result',
          toolUseId: block.tool_use_id,
          content: this.stringify(block.content),
          isError: block.is_error ?? false,
        },
      },
    ];
  }

  private result(message: Extract<SDKMessage, { type: 'result' }>): RuntimeEvent[] {
    const isError = message.subtype !== 'success' || message.is_error;
    const text =
      message.subtype === 'success'
        ? message.result
        : message.errors.join('\n') || `The agent stopped: ${message.subtype}`;
    return [
      { type: 'message', payload: { kind: 'result', text, isError } },
      { type: 'finished', resultText: text, isError, usage: this.usage(message) },
    ];
  }

  private usage(message: Extract<SDKMessage, { type: 'result' }>): RunUsage {
    return {
      numTurns: message.num_turns,
      apiDurationMs: message.duration_api_ms ?? null,
      models: Object.entries(message.modelUsage ?? {}).map(([model, usage]) => ({
        model: usage.canonicalModel ?? model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadInputTokens,
        cacheCreationTokens: usage.cacheCreationInputTokens,
        costUsd: usage.costUSD,
      })),
    };
  }

  private blocksOf(content: unknown): ContentBlock[] {
    return Array.isArray(content) ? (content as ContentBlock[]) : [];
  }

  private stringify(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return JSON.stringify(content ?? '');
    return (content as ContentBlock[])
      .map((part) => (part.type === 'text' ? (part.text ?? '') : `[${part.type}]`))
      .join('\n');
  }
}
