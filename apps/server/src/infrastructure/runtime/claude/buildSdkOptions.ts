import type { CanUseTool, HookCallback, Options } from '@anthropic-ai/claude-agent-sdk';
import { findUnsafeProcessCommand } from '../../../application/security/processSafetyPolicy.js';
import type { AgentRunRequest } from '../../../application/ports/AgentRuntime.js';
import { createFleetToolServer, FLEET_SERVER_NAME, FLEET_TOOL_NAMES } from './FleetToolServer.js';

export interface ClaudeRuntimeConfig {
  /** Path to a `claude` binary; the SDK's bundled one is used when omitted. */
  executablePath?: string;
  /** Cap on the characters of a Bash output kept in the agent's context. */
  bashMaxOutputChars?: number;
  /** Command of a PreToolUse hook for Bash that rewrites commands (for example RTK's). */
  bashRewriteHook?: string;
}

const MCP_TOOL_PREFIX = 'mcp__';
const SKILL_TOOL = 'Skill';

// In acceptEdits mode, calls to tools outside the allow-list would wait for an approval nobody gives.
const denyUnlistedTool: CanUseTool = async (toolName) => ({
  behavior: 'deny',
  message: `The tool "${toolName}" is not enabled for this agent.`,
});

/** Blocks shell commands that could stop processes the agent did not start (such as this app). */
export const guardProcessCommands: HookCallback = async (input) => {
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

/** `env` replaces the subprocess environment, so the process one is inherited explicitly. */
function environmentFor(config: ClaudeRuntimeConfig): Record<string, string> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return {
    ...inherited,
    // Connectors from claude.ai would add their tools and instructions to every prompt.
    ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    ...(config.bashMaxOutputChars ? { BASH_MAX_OUTPUT_LENGTH: String(config.bashMaxOutputChars) } : {}),
  };
}

function settingsFor(config: ClaudeRuntimeConfig): NonNullable<Options['settings']> {
  return {
    autoMemoryEnabled: false,
    ...(config.bashRewriteHook
      ? {
          hooks: {
            PreToolUse: [
              { matcher: 'Bash', hooks: [{ type: 'command' as const, command: config.bashRewriteHook }] },
            ],
          },
        }
      : {}),
  };
}

/**
 * Builds the SDK options of a run keeping the model's base context small: only the built-in
 * tools the agent may use are defined, and no memory or foreign MCP servers are loaded. Skills are
 * off unless the agent was assigned some: then only those are enabled, the `Skill` tool is added,
 * and the user's skills are found through `skillsDirectory` (never through the `user` setting
 * source, which would also load the user's hooks, permissions and plugins). Plugin skills load their
 * plugin through `pluginPaths`, which also brings the plugin's other parts (hooks, commands, agents).
 */
export function buildSdkOptions(
  request: AgentRunRequest,
  config: ClaudeRuntimeConfig,
  abortController: AbortController,
): Options {
  const hasSkills = request.skills.length > 0;
  const withSkillTool = (tools: string[]) => (hasSkills ? [...new Set([...tools, SKILL_TOOL])] : tools);
  return {
    cwd: request.workspacePath,
    model: request.model,
    effort: request.effort,
    maxTurns: request.maxTurns,
    permissionMode: request.permissionMode,
    allowDangerouslySkipPermissions: request.permissionMode === 'bypassPermissions',
    tools: withSkillTool(request.allowedTools.filter((tool) => !tool.startsWith(MCP_TOOL_PREFIX))),
    allowedTools: withSkillTool([...request.allowedTools, ...FLEET_TOOL_NAMES]),
    ...(request.permissionMode === 'acceptEdits' ? { canUseTool: denyUnlistedTool } : {}),
    systemPrompt: { type: 'preset', preset: 'claude_code', append: request.systemPromptAppendix },
    settingSources: ['project'],
    settings: settingsFor(config),
    skills: request.skills,
    ...(hasSkills && request.skillsDirectory ? { additionalDirectories: [request.skillsDirectory] } : {}),
    ...(request.pluginPaths.length > 0
      ? { plugins: request.pluginPaths.map((path) => ({ type: 'local' as const, path })) }
      : {}),
    strictMcpConfig: true,
    env: environmentFor(config),
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [guardProcessCommands] }] },
    mcpServers: { [FLEET_SERVER_NAME]: createFleetToolServer(request.delegation) },
    abortController,
    ...(request.resumeSessionId ? { resume: request.resumeSessionId } : {}),
    ...(config.executablePath ? { pathToClaudeCodeExecutable: config.executablePath } : {}),
  };
}
