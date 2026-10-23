import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk';
import type { AgentRunRequest } from '../../src/application/ports/AgentRuntime.js';
import {
  buildSdkOptions,
  selectMcpServers,
  type ClaudeRuntimeConfig,
} from '../../src/infrastructure/runtime/claude/buildSdkOptions.js';
import type { UserMcpServerConfig } from '../../src/infrastructure/runtime/claude/ClaudeUserMcpServers.js';
import { FLEET_TOOL_NAMES } from '../../src/infrastructure/runtime/claude/FleetToolServer.js';

function requestWith(overrides: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    prompt: 'task',
    systemPromptAppendix: 'appendix',
    model: 'sonnet',
    effort: 'low',
    allowedTools: ['Read', 'Bash', 'mcp__other__tool'],
    skills: [],
    skillsDirectory: null,
    pluginPaths: [],
    permissionMode: 'dontAsk',
    maxTurns: 5,
    maxOutputTokens: null,
    mcpServers: [],
    workspacePath: '/workspace',
    resumeSessionId: null,
    signal: new AbortController().signal,
    delegation: {
      listCollaborators: () => [],
      delegate: vi.fn(),
      proposeTask: vi.fn(),
      reportResult: vi.fn(),
    },
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

  describe('skills', () => {
    it('keeps skills off when the agent has none', () => {
      const options = build({ skillsDirectory: '/bridge' });
      expect(options.skills).toEqual([]);
      expect(options.tools).not.toContain('Skill');
      expect(options.allowedTools).not.toContain('Skill');
      expect(options).not.toHaveProperty('additionalDirectories');
    });

    it('enables only the assigned skills and the Skill tool', () => {
      const options = build({ skills: ['graphify'], skillsDirectory: '/bridge' });
      expect(options.skills).toEqual(['graphify']);
      expect(options.tools).toEqual(['Read', 'Bash', 'Skill']);
      expect(options.allowedTools).toContain('Skill');
      expect(options.additionalDirectories).toEqual(['/bridge']);
      expect(options.settingSources).toEqual(['project']);
    });

    it('does not duplicate the Skill tool when the agent already lists it', () => {
      const options = build({ skills: ['graphify'], allowedTools: ['Read', 'Skill'] });
      expect((options.tools as string[]).filter((tool) => tool === 'Skill')).toHaveLength(1);
      expect(options.allowedTools?.filter((tool) => tool === 'Skill')).toHaveLength(1);
    });

    it('loads the plugins that provide the assigned skills', () => {
      const options = build({ skills: ['caveman:caveman'], pluginPaths: ['/p/a', '/p/b'] });
      expect(options.plugins).toEqual([
        { type: 'local', path: '/p/a' },
        { type: 'local', path: '/p/b' },
      ]);
      expect(options.settingSources).toEqual(['project']);
    });

    it('adds no plugins option without plugin paths', () => {
      expect(build({ skills: ['graphify'] })).not.toHaveProperty('plugins');
      expect(build()).not.toHaveProperty('plugins');
    });

    it('adds no additional directory without a skills directory', () => {
      const options = build({ skills: ['graphify'], skillsDirectory: null });
      expect(options.skills).toEqual(['graphify']);
      expect(options).not.toHaveProperty('additionalDirectories');
    });
  });

  describe('output cap', () => {
    it('passes maxOutputTokens to Claude Code through its environment', () => {
      expect(build({ maxOutputTokens: 4096 }).env?.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('4096');
    });

    it('sets nothing when the agent has no cap', () => {
      vi.stubEnv('CLAUDE_CODE_MAX_OUTPUT_TOKENS', undefined);
      expect(build({ maxOutputTokens: null }).env).not.toHaveProperty('CLAUDE_CODE_MAX_OUTPUT_TOKENS');
    });
  });

  describe('user MCP servers', () => {
    const github: UserMcpServerConfig = { type: 'stdio', command: 'gh-mcp', env: { TOKEN: 'secret' } };
    const docs: UserMcpServerConfig = { type: 'http', url: 'https://docs.example/mcp' };

    it('loads the given servers next to the fleet server and allows all their tools', () => {
      const options = buildSdkOptions(requestWith(), {}, new AbortController(), { github, docs });

      expect(Object.keys(options.mcpServers ?? {})).toEqual(['github', 'docs', 'fleet']);
      expect(options.mcpServers?.github).toEqual(github);
      expect(options.allowedTools).toEqual([
        'Read',
        'Bash',
        'mcp__other__tool',
        'mcp__github',
        'mcp__docs',
        ...FLEET_TOOL_NAMES,
      ]);
      expect(options.strictMcpConfig).toBe(true);
    });

    it('selects the configured servers and reports the unknown ones', () => {
      expect(selectMcpServers(['docs', 'ghost', 'github'], { github, docs })).toEqual({
        servers: { docs, github },
        missing: ['ghost'],
      });
    });

    it('never lets a user server replace the fleet server or match inherited properties', () => {
      const fleet: UserMcpServerConfig = { type: 'stdio', command: 'evil' };
      expect(selectMcpServers(['fleet', 'toString', '__proto__'], { fleet })).toEqual({
        servers: {},
        missing: ['fleet', 'toString', '__proto__'],
      });
    });
  });
});
