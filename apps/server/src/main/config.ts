import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../../../../..');

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  maxDelegationDepth: number;
  /** Ports of this app (API and web) that agents must not use or stop. */
  reservedPorts: number[];
  allowedOrigin: string;
  /** Directory with the user's Agent Skills (one folder with a SKILL.md per skill). */
  userSkillsDir: string;
  claudeExecutablePath?: string;
  /** Cap on the characters of a Bash output that stay in an agent's context. */
  bashMaxOutputChars: number;
  /** Command of a PreToolUse hook for Bash that rewrites commands to save tokens. */
  bashRewriteHook?: string;
}

const DEFAULT_BASH_MAX_OUTPUT_CHARS = 15000;

function portOf(origin: string): number {
  const { port, protocol } = new URL(origin);
  if (port) return Number(port);
  return protocol === 'https:' ? 443 : 80;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 4100);
  const allowedOrigin = env.WEB_ORIGIN ?? 'http://localhost:5173';
  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    databasePath: env.DATABASE_PATH ?? resolve(repositoryRoot, 'data/fleet.db'),
    maxDelegationDepth: Number(env.MAX_DELEGATION_DEPTH ?? 4),
    allowedOrigin,
    userSkillsDir: env.USER_SKILLS_DIR ?? join(homedir(), '.claude', 'skills'),
    reservedPorts: [port, portOf(allowedOrigin)],
    bashMaxOutputChars: Number(env.AGENT_BASH_MAX_OUTPUT ?? DEFAULT_BASH_MAX_OUTPUT_CHARS),
    ...optionalSettings(env),
  };
}

function optionalSettings(
  env: NodeJS.ProcessEnv,
): Pick<AppConfig, 'bashRewriteHook' | 'claudeExecutablePath'> {
  return {
    ...(env.AGENT_BASH_REWRITE_HOOK ? { bashRewriteHook: env.AGENT_BASH_REWRITE_HOOK } : {}),
    ...(env.CLAUDE_EXECUTABLE ? { claudeExecutablePath: env.CLAUDE_EXECUTABLE } : {}),
  };
}
