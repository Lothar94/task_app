import type {
  AgentRunRequest,
  AgentRuntime,
  RuntimeEvent,
} from '../../src/application/ports/AgentRuntime.js';

export type AgentBehaviour = (request: AgentRunRequest) => Promise<string> | string;

/** Runs scripted behaviours keyed by agent name instead of calling Claude. */
export class FakeAgentRuntime implements AgentRuntime {
  readonly requests: AgentRunRequest[] = [];

  constructor(private readonly behaviours: Record<string, AgentBehaviour>) {}

  async *run(request: AgentRunRequest): AsyncIterable<RuntimeEvent> {
    this.requests.push(request);
    const name = this.agentNameOf(request);
    yield { type: 'session_started', sessionId: `session-${name}-${this.requests.length}` };
    yield { type: 'message', payload: { kind: 'assistant_text', text: `${name} working` } };
    const behaviour = this.behaviours[name] ?? (() => `${name} done`);
    const resultText = await behaviour(request);
    if (request.signal.aborted) throw new Error('aborted');
    yield {
      type: 'finished',
      resultText,
      isError: false,
      usage: {
        numTurns: 3,
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

  private agentNameOf(request: AgentRunRequest): string {
    const match = /You are "([^"]+)"/.exec(request.systemPromptAppendix);
    if (!match?.[1]) throw new Error('Agent name not found in system prompt');
    return match[1];
  }
}

export function waitForAbort(signal: AbortSignal): Promise<string> {
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve('aborted'), { once: true }));
}
