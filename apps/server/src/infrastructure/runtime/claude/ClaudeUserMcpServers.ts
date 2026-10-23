import { readFile } from 'node:fs/promises';
import type {
  McpHttpServerConfig,
  McpSSEServerConfig,
  McpStdioServerConfig,
} from '@anthropic-ai/claude-agent-sdk';
import { MCP_SERVER_NAME_PATTERN, type McpServerDto, type McpTransport } from '@fleet/shared';
import type { Logger } from '../../../application/ports/Logger.js';
import type { McpServerCatalog } from '../../../application/ports/McpServerCatalog.js';

export type UserMcpServerConfig = McpStdioServerConfig | McpHttpServerConfig | McpSSEServerConfig;

/** Launch configs of the user's MCP servers by name; they may hold secrets, so they stay in the runtime. */
export interface UserMcpServerSource {
  configs(): Promise<Record<string, UserMcpServerConfig>>;
}

/**
 * Reads the top-level `mcpServers` of Claude Code's user config (`~/.claude.json`). Read-only and
 * read on every call, so changes apply without restarting. Entries with an unknown transport, a
 * malformed shape or a name agents cannot reference are skipped.
 */
export class ClaudeUserMcpServers implements McpServerCatalog, UserMcpServerSource {
  constructor(
    private readonly configFile: string,
    private readonly logger: Logger,
  ) {}

  async list(): Promise<McpServerDto[]> {
    const configs = await this.configs();
    return Object.entries(configs)
      .map(([name, config]) => ({ name, transport: transportOf(config) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async configs(): Promise<Record<string, UserMcpServerConfig>> {
    const servers = asRecord(asRecord(await this.readConfig()).mcpServers);
    const parsed = Object.entries(servers).flatMap(([name, raw]) => {
      const config = MCP_SERVER_NAME_PATTERN.test(name) ? parseServer(asRecord(raw)) : null;
      return config ? [[name, config] as const] : [];
    });
    return Object.fromEntries(parsed);
  }

  private async readConfig(): Promise<unknown> {
    try {
      return JSON.parse(await readFile(this.configFile, 'utf8'));
    } catch (error) {
      this.logger.warn(`No MCP servers available: cannot read ${this.configFile} (${describe(error)})`);
      return null;
    }
  }
}

/** Keeps only the fields Claude Code uses to launch or reach the server. */
function parseServer(raw: Record<string, unknown>): UserMcpServerConfig | null {
  const type = raw.type ?? 'stdio';
  if (type === 'stdio') return parseStdioServer(raw);
  if (type === 'http' || type === 'sse') return parseRemoteServer(type, raw);
  return null;
}

function parseStdioServer(raw: Record<string, unknown>): McpStdioServerConfig | null {
  if (!isNonEmptyString(raw.command)) return null;
  return {
    type: 'stdio',
    command: raw.command,
    ...(isStringArray(raw.args) ? { args: raw.args } : {}),
    ...(isStringRecord(raw.env) ? { env: raw.env } : {}),
  };
}

function parseRemoteServer(
  type: 'http' | 'sse',
  raw: Record<string, unknown>,
): McpHttpServerConfig | McpSSEServerConfig | null {
  if (!isNonEmptyString(raw.url)) return null;
  return { type, url: raw.url, ...(isStringRecord(raw.headers) ? { headers: raw.headers } : {}) };
}

const transportOf = (config: UserMcpServerConfig): McpTransport => config.type ?? 'stdio';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value !== '';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === 'string');

const describe = (error: unknown) =>
  (error as NodeJS.ErrnoException).code ?? (error instanceof Error ? error.message : String(error));
