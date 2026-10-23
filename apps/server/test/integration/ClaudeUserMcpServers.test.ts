import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeUserMcpServers } from '../../src/infrastructure/runtime/claude/ClaudeUserMcpServers.js';

const SECRETS = ['secret-token', 'super-secret-header', '--api-key=xyz', 'https://user:pass@mcp.example'];

const USER_CONFIG = {
  numStartups: 42,
  projects: { '/repo': { mcpServers: { local: { command: 'project-only' } } } },
  mcpServers: {
    github: { command: 'npx', args: ['github-mcp', '--api-key=xyz'], env: { GITHUB_TOKEN: 'secret-token' } },
    explicit: { type: 'stdio', command: 'explicit-mcp' },
    remote: {
      type: 'http',
      url: 'https://user:pass@mcp.example',
      headers: { Authorization: 'super-secret-header' },
    },
    stream: { type: 'sse', url: 'https://sse.example/mcp' },
    weird: { type: 'websocket', url: 'wss://nope' },
    broken: { type: 'http' },
    'bad name': { command: 'x' },
    nocommand: { args: ['x'] },
  },
};

describe('ClaudeUserMcpServers', () => {
  let dir: string;
  let file: string;
  let warnings: string[];
  let catalog: ClaudeUserMcpServers;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fleet-mcp-'));
    file = join(dir, '.claude.json');
    warnings = [];
    catalog = new ClaudeUserMcpServers(file, {
      info: () => undefined,
      warn: (message) => void warnings.push(message),
      error: () => undefined,
    });
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('lists the user servers by name and transport only, sorted, skipping unusable entries', async () => {
    await writeFile(file, JSON.stringify(USER_CONFIG));

    const servers = await catalog.list();

    expect(servers).toEqual([
      { name: 'explicit', transport: 'stdio' },
      { name: 'github', transport: 'stdio' },
      { name: 'remote', transport: 'http' },
      { name: 'stream', transport: 'sse' },
    ]);
    const serialized = JSON.stringify(servers);
    for (const secret of SECRETS) expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(/command|args|url|env|headers/);
  });

  it('keeps the launch configs, with only the known fields, for the runtime', async () => {
    await writeFile(
      file,
      JSON.stringify({ mcpServers: { github: { ...USER_CONFIG.mcpServers.github, cwd: '/x', extra: 1 } } }),
    );

    expect(await catalog.configs()).toEqual({
      github: {
        type: 'stdio',
        command: 'npx',
        args: ['github-mcp', '--api-key=xyz'],
        env: { GITHUB_TOKEN: 'secret-token' },
      },
    });
  });

  it('is empty, with a warning, when the file is missing', async () => {
    expect(await catalog.list()).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ENOENT');
  });

  it('is empty, with a warning, when the file is not JSON', async () => {
    await writeFile(file, '{oops');
    expect(await catalog.list()).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('is empty when the file has no usable mcpServers', async () => {
    await writeFile(file, JSON.stringify({ mcpServers: ['not', 'an', 'object'] }));
    expect(await catalog.list()).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
