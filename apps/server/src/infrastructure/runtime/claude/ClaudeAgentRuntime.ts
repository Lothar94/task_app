import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentRuntimeSupportDto } from '@fleet/shared';
import type { AgentRunRequest, AgentRuntime, RuntimeEvent } from '../../../application/ports/AgentRuntime.js';
import type { Logger } from '../../../application/ports/Logger.js';
import { buildSdkOptions, selectMcpServers, type ClaudeRuntimeConfig } from './buildSdkOptions.js';
import type { UserMcpServerSource } from './ClaudeUserMcpServers.js';
import type { SdkMessageMapper } from './SdkMessageMapper.js';

export type { ClaudeRuntimeConfig };

/**
 * Runs agents through the Claude Agent SDK, which drives Claude Code and therefore
 * authenticates with the Claude subscription the local CLI is logged in with.
 */
export class ClaudeAgentRuntime implements AgentRuntime {
  /** The SDK has no sampling temperature; the output cap goes through Claude Code's environment. */
  readonly supports: AgentRuntimeSupportDto = { temperature: false, maxOutputTokens: true };

  constructor(
    private readonly mapper: SdkMessageMapper,
    private readonly mcpServers: UserMcpServerSource,
    private readonly logger: Logger,
    private readonly config: ClaudeRuntimeConfig = {},
  ) {}

  async *run(request: AgentRunRequest): AsyncIterable<RuntimeEvent> {
    const messages = query({
      prompt: request.prompt,
      options: buildSdkOptions(
        request,
        this.config,
        this.controllerFor(request.signal),
        await this.mcpServersFor(request),
      ),
    });
    for await (const message of messages) {
      yield* this.mapper.map(message);
    }
  }

  private async mcpServersFor(request: AgentRunRequest) {
    if (request.mcpServers.length === 0) return {};
    const { servers, missing } = selectMcpServers(request.mcpServers, await this.mcpServers.configs());
    if (missing.length > 0) {
      this.logger.warn(`Skipping MCP servers not configured for the user: ${missing.join(', ')}`);
    }
    return servers;
  }

  private controllerFor(signal: AbortSignal): AbortController {
    const controller = new AbortController();
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', () => controller.abort(), { once: true });
    return controller;
  }
}
