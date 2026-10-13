import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentRunRequest, AgentRuntime, RuntimeEvent } from '../../../application/ports/AgentRuntime.js';
import { buildSdkOptions, type ClaudeRuntimeConfig } from './buildSdkOptions.js';
import type { SdkMessageMapper } from './SdkMessageMapper.js';

export type { ClaudeRuntimeConfig };

/**
 * Runs agents through the Claude Agent SDK, which drives Claude Code and therefore
 * authenticates with the Claude subscription the local CLI is logged in with.
 */
export class ClaudeAgentRuntime implements AgentRuntime {
  constructor(
    private readonly mapper: SdkMessageMapper,
    private readonly config: ClaudeRuntimeConfig = {},
  ) {}

  async *run(request: AgentRunRequest): AsyncIterable<RuntimeEvent> {
    const messages = query({
      prompt: request.prompt,
      options: buildSdkOptions(request, this.config, this.controllerFor(request.signal)),
    });
    for await (const message of messages) {
      yield* this.mapper.map(message);
    }
  }

  private controllerFor(signal: AbortSignal): AbortController {
    const controller = new AbortController();
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', () => controller.abort(), { once: true });
    return controller;
  }
}
