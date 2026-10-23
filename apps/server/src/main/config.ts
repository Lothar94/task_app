import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MODEL_PRICES,
  mergePriceEntries,
  type ModelPriceEntry,
} from '../application/metrics/ModelPriceTable.js';
import { loadModelPricingFile } from './modelPricingFile.js';

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../../../../..');

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  maxDelegationDepth: number;
  /** Ports of this app (API and web) that agents must not use or stop. */
  reservedPorts: number[];
  allowedOrigin: string;
  /** Version of the app, read from the server package.json. */
  appVersion: string;
  /** Directory with the user's Agent Skills (one folder with a SKILL.md per skill). */
  userSkillsDir: string;
  /** Claude Code's config directory, where installed plugins and their enabled state are read. */
  claudeConfigDir: string;
  /** Claude Code's user config (`.claude.json`), where the user's MCP servers are read. */
  claudeUserConfigFile: string;
  claudeExecutablePath?: string;
  /** Cap on the characters of a Bash output that stay in an agent's context. */
  bashMaxOutputChars: number;
  /** Command of a PreToolUse hook for Bash that rewrites commands to save tokens. */
  bashRewriteHook?: string;
  /** Price table of the usage dashboard: the defaults plus the entries of MODEL_PRICING_FILE. */
  modelPrices: ModelPriceEntry[];
}

const DEFAULT_BASH_MAX_OUTPUT_CHARS = 15000;

function readAppVersion(): string {
  const manifest: unknown = JSON.parse(readFileSync(resolve(repositoryRoot, 'apps/server/package.json'), 'utf8'));
  const version = (manifest as { version?: unknown }).version;
  if (typeof version !== 'string') throw new Error('apps/server/package.json has no version');
  return version;
}

function portOf(origin: string): number {
  const { port, protocol } = new URL(origin);
  if (port) return Number(port);
  return protocol === 'https:' ? 443 : 80;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 4100);
  const claudeConfigDir = env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const allowedOrigin = env.WEB_ORIGIN ?? 'http://localhost:5173';
  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    databasePath: env.DATABASE_PATH ?? resolve(repositoryRoot, 'data/fleet.db'),
    maxDelegationDepth: Number(env.MAX_DELEGATION_DEPTH ?? 4),
    allowedOrigin,
    appVersion: readAppVersion(),
    claudeConfigDir,
    userSkillsDir: env.USER_SKILLS_DIR ?? join(claudeConfigDir, 'skills'),
    claudeUserConfigFile: userConfigFileOf(env),
    reservedPorts: [port, portOf(allowedOrigin)],
    bashMaxOutputChars: Number(env.AGENT_BASH_MAX_OUTPUT ?? DEFAULT_BASH_MAX_OUTPUT_CHARS),
    modelPrices: modelPricesOf(env),
    ...optionalSettings(env),
  };
}

/**
 * CLAUDE_USER_CONFIG_FILE, or where Claude Code keeps `.claude.json`: CLAUDE_CONFIG_DIR when it is
 * set, otherwise the home directory.
 */
function userConfigFileOf(env: NodeJS.ProcessEnv): string {
  return env.CLAUDE_USER_CONFIG_FILE ?? join(env.CLAUDE_CONFIG_DIR ?? homedir(), '.claude.json');
}

function modelPricesOf(env: NodeJS.ProcessEnv): ModelPriceEntry[] {
  const overrides = env.MODEL_PRICING_FILE ? loadModelPricingFile(env.MODEL_PRICING_FILE) : [];
  return mergePriceEntries(DEFAULT_MODEL_PRICES, overrides);
}

function optionalSettings(
  env: NodeJS.ProcessEnv,
): Pick<AppConfig, 'bashRewriteHook' | 'claudeExecutablePath'> {
  return {
    ...(env.AGENT_BASH_REWRITE_HOOK ? { bashRewriteHook: env.AGENT_BASH_REWRITE_HOOK } : {}),
    ...(env.CLAUDE_EXECUTABLE ? { claudeExecutablePath: env.CLAUDE_EXECUTABLE } : {}),
  };
}
