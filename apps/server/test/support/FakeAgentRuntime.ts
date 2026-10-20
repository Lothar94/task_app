import type {
  AgentRunRequest,
  AgentRuntime,
  RuntimeEvent,
} from '../../src/application/ports/AgentRuntime.js';

export type AgentBehaviour = (request: AgentRunRequest) => Promise<string> | string;

/** Runs scripted behaviours keyed by agent name instead of calling Claude. */
export class FakeAgentRuntime implements AgentRuntime {
  readonly requests: AgentRunRequest[] = [];
  /** Agents (by name) that call one tool taking this many milliseconds before finishing. */
  readonly toolDelaysMs: Record<string, number> = {};

  constructor(private readonly behaviours: Record<string, AgentBehaviour>) {}

  async *run(request: AgentRunRequest): AsyncIterable<RuntimeEvent> {
    this.requests.push(request);
    const name = this.agentNameOf(request);
    yield { type: 'session_started', sessionId: `session-${name}-${this.requests.length}` };
    yield { type: 'message', payload: { kind: 'assistant_text', text: `${name} working` } };
    yield* this.toolCall(name);
    const behaviour = this.behaviours[name] ?? (() => `${name} done`);
    const resultText = await behaviour(request);
    if (request.signal.aborted) throw new Error('aborted');
    yield {
      type: 'finished',
      resultText,
      isError: false,
      usage: {
        numTurns: 3,
        apiDurationMs: 1200,
        models: [
          {
            model: 'claude-sonnet',
            inputTokens: 100,
            outputTokens: 50,
            cacheReadTokens: 1000,
            cacheCreationTokens: 10,
            costUsd: 0.01,
          },
        ],
      },
    };
  }

  private async *toolCall(name: string): AsyncIterable<RuntimeEvent> {
    const delayMs = this.toolDelaysMs[name];
    if (delayMs === undefined) return;
    const toolUseId = `tool-${name}`;
    yield { type: 'message', payload: { kind: 'tool_use', toolUseId, toolName: 'Bash', input: {} } };
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield { type: 'message', payload: { kind: 'tool_result', toolUseId, content: 'ok', isError: false } };
  }

  private agentNameOf(request: AgentRunRequest): string {
    const match = /You are "([^"]+)"/.exec(request.systemPromptAppendix);
    if (!match?.[1]) throw new Error('Agent name not found in system prompt');
    return match[1];
  }
}

export function waitForAbort(signal: AbortSignal): Promise<string> {
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve('aborted'), { once: true }));
}
