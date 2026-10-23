import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlanUsageUnavailableError } from '../../src/application/ports/PlanUsageSource.js';
import { ClaudeOAuthPlanUsageSource } from '../../src/infrastructure/system/ClaudeOAuthPlanUsageSource.js';

const NOW = Date.parse('2026-10-23T10:00:00.000Z');
const TOKEN = 'sk-ant-oat01-super-secret-token';
const clock = { now: () => new Date(NOW) };

interface Call {
  url: string;
  init: RequestInit;
}

describe('ClaudeOAuthPlanUsageSource', () => {
  let dir: string;
  let file: string;
  let calls: Call[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fleet-plan-usage-'));
    file = join(dir, '.credentials.json');
    calls = [];
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const writeCredentials = (oauth: Record<string, unknown> | undefined) =>
    writeFile(file, JSON.stringify(oauth === undefined ? {} : { claudeAiOauth: oauth }));
  const validOauth = { accessToken: TOKEN, expiresAt: NOW + 3_600_000, subscriptionType: 'max' };

  const sourceAnswering = (respond: () => Response | Promise<Response>) =>
    new ClaudeOAuthPlanUsageSource(
      file,
      clock,
      async (url, init) => {
        calls.push({ url, init });
        return respond();
      },
      1000,
    );
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  async function failureOf(source: ClaudeOAuthPlanUsageSource): Promise<PlanUsageUnavailableError> {
    const error = await source.fetch().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(PlanUsageUnavailableError);
    return error as PlanUsageUnavailableError;
  }

  it('maps five_hour to session and seven_day to weekly, ignoring extra keys', async () => {
    await writeCredentials(validOauth);
    const source = sourceAnswering(() =>
      jsonResponse({
        five_hour: { utilization: 86, resets_at: '2026-10-23T12:50:00.08+00:00', extra: 1 },
        seven_day: { utilization: 42.5, resets_at: '2026-10-27T09:00:00+00:00' },
        seven_day_opus: { utilization: 10, resets_at: null },
      }),
    );

    expect(await source.fetch()).toEqual({
      subscriptionType: 'max',
      session: { utilization: 86, resetsAt: '2026-10-23T12:50:00.08+00:00' },
      weekly: { utilization: 42.5, resetsAt: '2026-10-27T09:00:00+00:00' },
    });
  });

  it('sends the bearer token and the oauth beta header to the usage endpoint', async () => {
    await writeCredentials(validOauth);

    await sourceAnswering(() => jsonResponse({})).fetch();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.anthropic.com/api/oauth/usage');
    expect(calls[0]?.init.headers).toEqual({
      Authorization: `Bearer ${TOKEN}`,
      'anthropic-beta': 'oauth-2025-04-20',
    });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps null, missing and non-numeric windows to null', async () => {
    await writeCredentials(validOauth);
    const source = sourceAnswering(() =>
      jsonResponse({ five_hour: null, seven_day: { utilization: 'high', resets_at: null } }),
    );

    expect(await source.fetch()).toEqual({ subscriptionType: 'max', session: null, weekly: null });
  });

  it('clamps utilization to 0..100 and keeps a missing reset as null', async () => {
    await writeCredentials(validOauth);
    const source = sourceAnswering(() =>
      jsonResponse({ five_hour: { utilization: 130 }, seven_day: { utilization: -5, resets_at: 12 } }),
    );

    expect(await source.fetch()).toMatchObject({
      session: { utilization: 100, resetsAt: null },
      weekly: { utilization: 0, resetsAt: null },
    });
  });

  it('reports a missing credentials file as no_credentials', async () => {
    expect((await failureOf(sourceAnswering(() => jsonResponse({})))).reason).toBe('no_credentials');
    expect(calls).toHaveLength(0);
  });

  it('reports malformed JSON as no_credentials', async () => {
    await writeFile(file, '{ not json');

    expect((await failureOf(sourceAnswering(() => jsonResponse({})))).reason).toBe('no_credentials');
  });

  it.each([
    ['no claudeAiOauth entry', undefined],
    ['no access token', { expiresAt: NOW + 1000 }],
    ['an empty access token', { accessToken: '', expiresAt: NOW + 1000 }],
  ])('reports %s as no_credentials', async (_name, oauth) => {
    await writeCredentials(oauth);

    expect((await failureOf(sourceAnswering(() => jsonResponse({})))).reason).toBe('no_credentials');
    expect(calls).toHaveLength(0);
  });

  it('reports a token that expires now or earlier as expired_credentials without calling upstream', async () => {
    await writeCredentials({ ...validOauth, expiresAt: NOW });

    expect((await failureOf(sourceAnswering(() => jsonResponse({})))).reason).toBe('expired_credentials');
    expect(calls).toHaveLength(0);
  });

  it.each([401, 403, 429, 500])('reports a %i answer as upstream_error', async (status) => {
    await writeCredentials(validOauth);

    expect((await failureOf(sourceAnswering(() => jsonResponse({ error: 'x' }, status)))).reason).toBe(
      'upstream_error',
    );
  });

  it('reports a network failure as upstream_error', async () => {
    await writeCredentials(validOauth);
    const source = sourceAnswering(() => Promise.reject(new TypeError('fetch failed')));

    expect((await failureOf(source)).reason).toBe('upstream_error');
  });

  it('reports an invalid JSON body as upstream_error', async () => {
    await writeCredentials(validOauth);
    const source = sourceAnswering(() => new Response('<html>', { status: 200 }));

    expect((await failureOf(source)).reason).toBe('upstream_error');
  });

  it('reports a non-object JSON body as upstream_error', async () => {
    await writeCredentials(validOauth);

    expect((await failureOf(sourceAnswering(() => jsonResponse([1, 2])))).reason).toBe('upstream_error');
  });

  it('aborts a request that exceeds the timeout', async () => {
    await writeCredentials(validOauth);
    const source = new ClaudeOAuthPlanUsageSource(
      file,
      clock,
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      20,
    );

    expect((await failureOf(source)).reason).toBe('upstream_error');
  });

  it('never leaks the token in an error message', async () => {
    await writeCredentials(validOauth);
    const failures = [
      sourceAnswering(() => Promise.reject(new Error(`connect failed for Bearer ${TOKEN}`))),
      sourceAnswering(() => jsonResponse({ error: TOKEN }, 401)),
      sourceAnswering(() => new Response(TOKEN, { status: 200 })),
    ];

    for (const source of failures) {
      const error = await failureOf(source);
      expect(error.message).not.toContain(TOKEN);
      expect(String(error.stack)).not.toContain(TOKEN);
    }
  });
});
