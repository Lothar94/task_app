import { describe, expect, it } from 'vitest';
import { classifyFailure } from '../../src/application/projects/classifyFailure.js';

describe('classifyFailure', () => {
  it.each([
    'Claude AI usage limit reached|1760000000',
    "You've hit your limit · resets 5pm",
    '5-hour limit reached',
    'Session limit exceeded',
    'API Error: rate limit',
    'USAGE LIMIT',
  ])('detects a session limit in "%s"', (reason) => {
    expect(classifyFailure(reason)).toBe('session_limit');
  });

  it.each([
    'stop_reason max_tokens',
    'Token limit hit',
    'The context window is full',
    'context length exceeded',
    'Prompt is too long',
    'error_max_budget_usd',
    'Maximum context reached',
    'over budget',
  ])('detects a token limit in "%s"', (reason) => {
    expect(classifyFailure(reason)).toBe('token_limit');
  });

  it.each([null, undefined, '', 'Interrupted by a server restart', 'TypeError: x is undefined'])(
    'ignores %j',
    (reason) => {
      expect(classifyFailure(reason)).toBeNull();
    },
  );
});
