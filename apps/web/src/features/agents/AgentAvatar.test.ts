import { describe, expect, it } from 'vitest';
import { agentInitials } from './AgentAvatar';

describe('agentInitials', () => {
  it.each([
    ['Lara Backend', 'LB'],
    ['Conde', 'CO'],
    ['  vega  qa  ', 'VQ'],
    ['', '?'],
  ])('%j → %s', (name, expected) => {
    expect(agentInitials(name)).toBe(expected);
  });
});
