import type { AgentProfile } from '../../domain/agent/Agent.js';
import { ValidationError } from '../../domain/errors/DomainError.js';
import type { RuntimeCapabilities } from '../ports/AgentRuntime.js';

const RUNTIME_SETTINGS = ['temperature', 'maxOutputTokens'] as const;

/** Rejects (400) a setting the agent runtime would silently ignore. */
export function ensureRuntimeSupports(
  { supports }: RuntimeCapabilities,
  profile: Pick<AgentProfile, (typeof RUNTIME_SETTINGS)[number]>,
): void {
  const unsupported = RUNTIME_SETTINGS.find(
    (setting) => !supports[setting] && profile[setting] !== null && profile[setting] !== undefined,
  );
  if (unsupported) {
    throw new ValidationError(`${unsupported} is not supported by the agent runtime: leave it empty`);
  }
}
