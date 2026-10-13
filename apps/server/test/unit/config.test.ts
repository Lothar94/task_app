import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/main/config.js';

describe('loadConfig', () => {
  it('reserves the API and web ports for the app', () => {
    expect(loadConfig({}).reservedPorts).toEqual([4100, 5173]);
    expect(loadConfig({ PORT: '9000', WEB_ORIGIN: 'https://fleet.local' }).reservedPorts).toEqual([
      9000, 443,
    ]);
  });
});

describe('loadConfig agent output limits', () => {
  it('caps Bash output at 15000 characters by default and without a rewrite hook', () => {
    const config = loadConfig({});
    expect(config.bashMaxOutputChars).toBe(15000);
    expect(config).not.toHaveProperty('bashRewriteHook');
  });

  it('reads the Bash output cap and the rewrite hook from the environment', () => {
    const config = loadConfig({
      AGENT_BASH_MAX_OUTPUT: '5000',
      AGENT_BASH_REWRITE_HOOK: '/hooks/rewrite.sh',
    });
    expect(config.bashMaxOutputChars).toBe(5000);
    expect(config.bashRewriteHook).toBe('/hooks/rewrite.sh');
  });
});
