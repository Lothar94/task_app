import type { ModelTokenUsage } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_PRICES,
  mergePriceEntries,
  ModelPriceTable,
  pricingOf,
} from '../../src/application/metrics/ModelPriceTable.js';

const usage = (model: string, overrides: Partial<ModelTokenUsage> = {}): ModelTokenUsage => ({
  model,
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cacheReadTokens: 1_000_000,
  cacheCreationTokens: 1_000_000,
  costUsd: 0.42,
  ...overrides,
});

describe('ModelPriceTable', () => {
  const table = new ModelPriceTable();

  it('prices the default families with the cache multipliers', () => {
    expect(table.pricingFor('claude-opus-5-5')).toEqual({
      inputPerMTok: 5,
      outputPerMTok: 25,
      cacheWritePerMTok: 6.25,
      cacheReadPerMTok: 0.5,
    });
    expect(table.pricingFor('claude-sonnet-5-5')?.inputPerMTok).toBe(3);
    expect(table.pricingFor('CLAUDE-HAIKU-5-5')?.outputPerMTok).toBe(5);
  });

  it('answers null for unknown models', () => {
    expect(table.pricingFor('gpt-9')).toBeNull();
  });

  it('lets the longest match win', () => {
    const specific = new ModelPriceTable([
      { match: 'claude-opus', pricing: pricingOf(5, 25) },
      { match: 'claude-opus-4', pricing: pricingOf(15, 75) },
    ]);
    expect(specific.pricingFor('claude-opus-4-1')?.inputPerMTok).toBe(15);
    expect(specific.pricingFor('claude-opus-5-5')?.inputPerMTok).toBe(5);
  });

  it('estimates the cost by token kind and the cache savings', () => {
    expect(table.estimate(usage('claude-opus-5-5'))).toEqual({
      pricing: pricingOf(5, 25),
      cost: { inputUsd: 5, outputUsd: 25, cacheWriteUsd: 6.25, cacheReadUsd: 0.5 },
      costUsd: 36.75,
      cacheSavingsUsd: 4.5,
    });
  });

  it('keeps the reported cost of unpriced models', () => {
    expect(table.estimate(usage('mystery'))).toEqual({
      pricing: null,
      cost: { inputUsd: 0, outputUsd: 0, cacheWriteUsd: 0, cacheReadUsd: 0 },
      costUsd: 0.42,
      cacheSavingsUsd: 0,
    });
  });
});

describe('mergePriceEntries', () => {
  it('replaces defaults with the same match and adds the rest', () => {
    const merged = mergePriceEntries(DEFAULT_MODEL_PRICES, [
      { match: 'Claude-Opus', pricing: pricingOf(15, 75) },
      { match: 'gpt', pricing: pricingOf(2, 8) },
    ]);
    expect(merged.map((entry) => entry.match)).toEqual(['claude-sonnet', 'claude-haiku', 'Claude-Opus', 'gpt']);
  });
});
