import { mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_PRICES, pricingOf } from '../../src/application/metrics/ModelPriceTable.js';
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

describe('loadConfig user skills', () => {
  it('reads skills from ~/.claude/skills by default', () => {
    expect(loadConfig({}).userSkillsDir).toBe(join(homedir(), '.claude', 'skills'));
  });

  it('reads the skills directory from USER_SKILLS_DIR', () => {
    expect(loadConfig({ USER_SKILLS_DIR: '/opt/skills' }).userSkillsDir).toBe('/opt/skills');
  });

  it('defaults the Claude config directory to ~/.claude and derives the skills directory from it', () => {
    expect(loadConfig({}).claudeConfigDir).toBe(join(homedir(), '.claude'));
    const config = loadConfig({ CLAUDE_CONFIG_DIR: '/opt/claude' });
    expect(config.claudeConfigDir).toBe('/opt/claude');
    expect(config.userSkillsDir).toBe(join('/opt/claude', 'skills'));
  });
});

describe('loadConfig model prices', () => {
  const pricingFile = (content: string) => {
    const path = join(mkdtempSync(join(tmpdir(), 'fleet-pricing-')), 'prices.json');
    writeFileSync(path, content);
    return path;
  };

  it('uses the built-in price table without MODEL_PRICING_FILE', () => {
    expect(loadConfig({}).modelPrices).toEqual(DEFAULT_MODEL_PRICES);
  });

  it('merges the entries of MODEL_PRICING_FILE over the defaults', () => {
    const opus = { match: 'claude-opus', pricing: pricingOf(15, 75) };
    const custom = { match: 'my-model', pricing: pricingOf(1, 2) };
    const config = loadConfig({ MODEL_PRICING_FILE: pricingFile(JSON.stringify([opus, custom])) });
    expect(config.modelPrices).toEqual([...DEFAULT_MODEL_PRICES.slice(1), opus, custom]);
  });

  it('stops with a clear error when the file is invalid', () => {
    const badShape = pricingFile(JSON.stringify([{ match: '', pricing: { inputPerMTok: -1 } }]));
    expect(() => loadConfig({ MODEL_PRICING_FILE: badShape })).toThrow(/Invalid MODEL_PRICING_FILE/);
    expect(() => loadConfig({ MODEL_PRICING_FILE: pricingFile('not json') })).toThrow(
      /Invalid MODEL_PRICING_FILE/,
    );
    expect(() => loadConfig({ MODEL_PRICING_FILE: '/nope/prices.json' })).toThrow(/Invalid MODEL_PRICING_FILE/);
  });
});
