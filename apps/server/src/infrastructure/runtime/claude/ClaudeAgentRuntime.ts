import { type CanUseTool, type HookCallback, query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { findUnsafeProcessCommand } from '../../../application/security/processSafetyPolicy.js';
import type { AgentRunRequest, AgentRuntime, RuntimeEvent } from '../../../application/ports/AgentRuntime.js';
import { createFleetToolServer, FLEET_SERVER_NAME, FLEET_TOOL_NAMES } from './FleetToolServer.js';
import type { SdkMessageMapper } from './SdkMessageMapper.js';

export interface ClaudeRuntimeConfig {
  /** Path to a `claude` binary; the SDK's bundled one is used when omitted. */
  executablePath?: string;
}

// In acceptEdits mode, calls to tools outside the allow-list would wait for an approval nobody gives.
const denyUnlistedTool: CanUseTool = async (toolName) => ({
  behavior: 'deny',
  message: `The tool "${toolName}" is not enabled for this agent.`,
});

/** Blocks shell commands that could stop processes the agent did not start (such as this app). */
const guardProcessCommands: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};
  const command = (input.tool_input as { command?: unknown }).command;
  const reason = typeof command === 'string' ? findUnsafeProcessCommand(command) : null;
  if (!reason) return {};
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
};

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
    const messages = query({ prompt: request.prompt, options: this.optionsFor(request) });
    for await (const message of messages) {
      yield* this.mapper.map(message);
    }
  }

  private optionsFor(request: AgentRunRequest): Options {
    const allowedTools = [...request.allowedTools, ...FLEET_TOOL_NAMES];
    return {
      cwd: request.workspacePath,
      model: request.model,
      effort: request.effort,
      maxTurns: request.maxTurns,
      permissionMode: request.permissionMode,
      allowDangerouslySkipPermissions: request.permissionMode === 'bypassPermissions',
      allowedTools,
      ...(request.permissionMode === 'acceptEdits' ? { canUseTool: denyUnlistedTool } : {}),
      systemPrompt: { type: 'preset', preset: 'claude_code', append: request.systemPromptAppendix },
      settingSources: ['project'],
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [guardProcessCommands] }] },
      mcpServers: { [FLEET_SERVER_NAME]: createFleetToolServer(request.delegation) },
      abortController: this.controllerFor(request.signal),
      ...(request.resumeSessionId ? { resume: request.resumeSessionId } : {}),
      ...(this.config.executablePath ? { pathToClaudeCodeExecutable: this.config.executablePath } : {}),
    };
  }

  private controllerFor(signal: AbortSignal): AbortController {
    const controller = new AbortController();
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', () => controller.abort(), { once: true });
    return controller;
  }
}
