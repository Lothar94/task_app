import { describe, expect, it } from 'vitest';
import { classifyRunError } from '../../src/application/metrics/classifyRunError.js';

describe('classifyRunError', () => {
  it.each([
    ['API Error: 429 Too Many Requests', 'rate_limit'],
    ['rate_limit_error: slow down', 'rate_limit'],
    ['Overloaded', 'rate_limit'],
    ['Claude AI usage limit reached', 'session_limit'],
    ["You've hit your limit · resets 5pm", 'session_limit'],
    ['5-hour limit reached', 'session_limit'],
    ['Session limit reached, rate limit applies', 'session_limit'],
    ['prompt is too long: 210000 tokens', 'token_limit'],
    ['context window exceeded', 'token_limit'],
    ['Interrupted: the server stopped while the task was running', 'interrupted'],
    ['TypeError: boom', 'other'],
  ] as const)('classifies "%s" as %s', (error, cause) => {
    expect(classifyRunError(error)).toBe(cause);
  });

  it('treats a missing error as other', () => {
    expect(classifyRunError(null)).toBe('other');
    expect(classifyRunError('')).toBe('other');
  });
});
