import { resolve } from 'node:path';
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
  claudeExecutablePath?: string;
}

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
    reservedPorts: [port, portOf(allowedOrigin)],
    ...(env.CLAUDE_EXECUTABLE ? { claudeExecutablePath: env.CLAUDE_EXECUTABLE } : {}),
  };
}
