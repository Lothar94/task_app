import type { CostBreakdown, ModelPricing, ModelTokenUsage } from '@fleet/shared';

/** Prices a model whose id contains `match` (case-insensitive); the longest match wins. */
export interface ModelPriceEntry {
  match: string;
  pricing: ModelPricing;
}

export interface UsageEstimate {
  pricing: ModelPricing | null;
  cost: CostBreakdown;
  /** Sum of the breakdown when priced; otherwise the cost reported by Claude Code. */
  costUsd: number;
  cacheSavingsUsd: number;
}

const TOKENS_PER_MTOK = 1_000_000;
const CACHE_WRITE_FACTOR = 1.25;
const CACHE_READ_FACTOR = 0.1;

export const ZERO_COST: CostBreakdown = { inputUsd: 0, outputUsd: 0, cacheWriteUsd: 0, cacheReadUsd: 0 };

/** Pricing with the usual cache multipliers: writes at 1.25× and reads at 0.1× the input price. */
export function pricingOf(inputPerMTok: number, outputPerMTok: number): ModelPricing {
  return {
    inputPerMTok,
    outputPerMTok,
    cacheWritePerMTok: inputPerMTok * CACHE_WRITE_FACTOR,
    cacheReadPerMTok: inputPerMTok * CACHE_READ_FACTOR,
  };
}

/** Estimated list prices in USD per million tokens. */
export const DEFAULT_MODEL_PRICES: readonly ModelPriceEntry[] = [
  { match: 'claude-opus', pricing: pricingOf(5, 25) },
  { match: 'claude-sonnet', pricing: pricingOf(3, 15) },
  { match: 'claude-haiku', pricing: pricingOf(1, 5) },
];

/** Entries of `overrides` replace the defaults with the same match; the rest are added. */
export function mergePriceEntries(
  defaults: readonly ModelPriceEntry[],
  overrides: readonly ModelPriceEntry[],
): ModelPriceEntry[] {
  const overridden = new Set(overrides.map((entry) => entry.match.toLowerCase()));
  return [...defaults.filter((entry) => !overridden.has(entry.match.toLowerCase())), ...overrides];
}

const usd = (tokens: number, perMTok: number) => (tokens * perMTok) / TOKENS_PER_MTOK;

function costOf(usage: ModelTokenUsage, pricing: ModelPricing): CostBreakdown {
  return {
    inputUsd: usd(usage.inputTokens, pricing.inputPerMTok),
    outputUsd: usd(usage.outputTokens, pricing.outputPerMTok),
    cacheWriteUsd: usd(usage.cacheCreationTokens, pricing.cacheWritePerMTok),
    cacheReadUsd: usd(usage.cacheReadTokens, pricing.cacheReadPerMTok),
  };
}

const sumCost = (cost: CostBreakdown) =>
  cost.inputUsd + cost.outputUsd + cost.cacheWriteUsd + cost.cacheReadUsd;

export function addCost(a: CostBreakdown, b: CostBreakdown): CostBreakdown {
  return {
    inputUsd: a.inputUsd + b.inputUsd,
    outputUsd: a.outputUsd + b.outputUsd,
    cacheWriteUsd: a.cacheWriteUsd + b.cacheWriteUsd,
    cacheReadUsd: a.cacheReadUsd + b.cacheReadUsd,
  };
}

/** What the cache reads would have cost at the input price minus what they cost. */
const cacheSavingsOf = (usage: ModelTokenUsage, pricing: ModelPricing) =>
  usd(usage.cacheReadTokens, pricing.inputPerMTok - pricing.cacheReadPerMTok);

export class ModelPriceTable {
  private readonly entries: ModelPriceEntry[];

  constructor(entries: readonly ModelPriceEntry[] = DEFAULT_MODEL_PRICES) {
    this.entries = [...entries].sort((a, b) => b.match.length - a.match.length);
  }

  pricingFor(model: string): ModelPricing | null {
    const id = model.toLowerCase();
    return this.entries.find((entry) => id.includes(entry.match.toLowerCase()))?.pricing ?? null;
  }

  estimate(usage: ModelTokenUsage): UsageEstimate {
    const pricing = this.pricingFor(usage.model);
    if (!pricing) return { pricing, cost: ZERO_COST, costUsd: usage.costUsd, cacheSavingsUsd: 0 };
    const cost = costOf(usage, pricing);
    return { pricing, cost, costUsd: sumCost(cost), cacheSavingsUsd: cacheSavingsOf(usage, pricing) };
  }
}
