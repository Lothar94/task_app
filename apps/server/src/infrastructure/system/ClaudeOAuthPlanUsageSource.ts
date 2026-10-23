import { readFile } from 'node:fs/promises';
import type { PlanUsageWindowDto } from '@fleet/shared';
import type { Clock } from '../../application/ports/Clock.js';
import {
  PlanUsageUnavailableError,
  type PlanUsageReading,
  type PlanUsageSource,
} from '../../application/ports/PlanUsageSource.js';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_BETA = 'oauth-2025-04-20';
const DEFAULT_TIMEOUT_MS = 5000;

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

interface OAuthCredentials {
  accessToken: string;
  expiresAt: number | null;
  subscriptionType: string | null;
}

/**
 * Reads the plan usage from Anthropic's OAuth usage endpoint with the token Claude Code stores in
 * its credentials file. The token is only ever sent upstream: it is never logged or put in errors.
 */
export class ClaudeOAuthPlanUsageSource implements PlanUsageSource {
  constructor(
    private readonly credentialsFile: string,
    private readonly clock: Clock,
    private readonly fetchFn: FetchFunction = fetch,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetch(): Promise<PlanUsageReading> {
    const credentials = await this.readCredentials();
    if (credentials.expiresAt !== null && credentials.expiresAt <= this.clock.now().getTime()) {
      throw new PlanUsageUnavailableError('expired_credentials', 'Claude OAuth token has expired');
    }
    const body = await this.requestUsage(credentials.accessToken);
    return {
      subscriptionType: credentials.subscriptionType,
      session: windowOf(body.five_hour),
      weekly: windowOf(body.seven_day),
    };
  }

  private async readCredentials(): Promise<OAuthCredentials> {
    const missing = () => new PlanUsageUnavailableError('no_credentials', 'No Claude OAuth credentials found');
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.credentialsFile, 'utf8'));
    } catch {
      throw missing();
    }
    const oauth = asRecord(asRecord(parsed)?.claudeAiOauth);
    if (!oauth || typeof oauth.accessToken !== 'string' || oauth.accessToken === '') throw missing();
    return {
      accessToken: oauth.accessToken,
      expiresAt: typeof oauth.expiresAt === 'number' ? oauth.expiresAt : null,
      subscriptionType: typeof oauth.subscriptionType === 'string' ? oauth.subscriptionType : null,
    };
  }

  private async requestUsage(accessToken: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchFn(USAGE_URL, {
        headers: { Authorization: `Bearer ${accessToken}`, 'anthropic-beta': OAUTH_BETA },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw upstreamError('Usage request failed');
    }
    if (!response.ok) throw upstreamError(`Usage endpoint answered ${response.status}`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw upstreamError('Usage endpoint answered invalid JSON');
    }
    const record = asRecord(body);
    if (!record) throw upstreamError('Usage endpoint answered an unexpected body');
    return record;
  }
}

function upstreamError(message: string): PlanUsageUnavailableError {
  return new PlanUsageUnavailableError('upstream_error', message);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function windowOf(raw: unknown): PlanUsageWindowDto | null {
  const record = asRecord(raw);
  if (!record || typeof record.utilization !== 'number' || !Number.isFinite(record.utilization)) return null;
  return {
    utilization: Math.min(100, Math.max(0, record.utilization)),
    resetsAt: typeof record.resets_at === 'string' ? record.resets_at : null,
  };
}
