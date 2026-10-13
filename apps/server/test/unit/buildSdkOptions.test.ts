import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk';
import type { AgentRunRequest } from '../../src/application/ports/AgentRuntime.js';
import {
  buildSdkOptions,
  type ClaudeRuntimeConfig,
} from '../../src/infrastructure/runtime/claude/buildSdkOptions.js';
import { FLEET_TOOL_NAMES } from '../../src/infrastructure/runtime/claude/FleetToolServer.js';

function requestWith(overrides: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    prompt: 'task',
    systemPromptAppendix: 'appendix',
    model: 'sonnet',
    effort: 'low',
    allowedTools: ['Read', 'Bash', 'mcp__other__tool'],
    permissionMode: 'dontAsk',
    maxTurns: 5,
    workspacePath: '/workspace',
    resumeSessionId: null,
    signal: new AbortController().signal,
    delegation: { listCollaborators: () => [], delegate: vi.fn(), reportResult: vi.fn() },
    ...overrides,
  };
}

function build(overrides: Partial<AgentRunRequest> = {}, config: ClaudeRuntimeConfig = {}) {
  return buildSdkOptions(requestWith(overrides), config, new AbortController());
}

afterEach(() => vi.unstubAllEnvs());

describe('buildSdkOptions', () => {
  it('defines only the built-in tools the agent may use', () => {
    expect(build().tools).toEqual(['Read', 'Bash']);
  });

  it('keeps auto-approving the allowed tools and the fleet tools', () => {
    expect(build().allowedTools).toEqual(['Read', 'Bash', 'mcp__other__tool', ...FLEET_TOOL_NAMES]);
  });

  it('loads no foreign MCP servers, skills or memory', () => {
    const options = build();
    expect(options.strictMcpConfig).toBe(true);
    expect(options.skills).toEqual([]);
    expect(options.settings).toMatchObject({ autoMemoryEnabled: false });
    expect(options.env).toMatchObject({
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    });
    expect(Object.keys(options.mcpServers ?? {})).toEqual(['fleet']);
  });

  it('inherits the process environment and caps the Bash output', () => {
    vi.stubEnv('FLEET_TEST_VARIABLE', 'inherited');
    const { env } = build({}, { bashMaxOutputChars: 8000 });
    expect(env).toMatchObject({ FLEET_TEST_VARIABLE: 'inherited', BASH_MAX_OUTPUT_LENGTH: '8000' });
  });

  it('leaves the Bash output cap alone when not configured', () => {
    expect(build().env).not.toHaveProperty('BASH_MAX_OUTPUT_LENGTH');
  });

  it('denies unlisted tools only in acceptEdits mode', () => {
    expect(build({ permissionMode: 'acceptEdits' }).canUseTool).toBeTypeOf('function');
    expect(build({ permissionMode: 'dontAsk' }).canUseTool).toBeUndefined();
  });

  it('resumes a session only when there is one to resume', () => {
    expect(build().resume).toBeUndefined();
    expect(build({ resumeSessionId: 'abc' }).resume).toBe('abc');
  });

  it('registers the rewrite hook only when configured', () => {
    expect(build().settings).not.toHaveProperty('hooks');
    expect(build({}, { bashRewriteHook: '/hooks/rewrite.sh' }).settings).toMatchObject({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/hooks/rewrite.sh' }] }],
      },
    });
  });

  it('keeps the process guard blocking name-based kills when the rewrite hook is on', async () => {
    const options = build({}, { bashRewriteHook: '/hooks/rewrite.sh' });
    const [guard] = (options.hooks?.PreToolUse ?? []) as HookCallbackMatcher[];
    const input = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'pkill node' },
    };
    const result = await guard!.hooks[0]!(input as never, undefined, {
      signal: new AbortController().signal,
    });
    expect(result).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
  });
});
