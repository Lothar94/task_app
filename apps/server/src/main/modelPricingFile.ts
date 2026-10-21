import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { ModelPriceEntry } from '../application/metrics/ModelPriceTable.js';

const price = z.number().finite().nonnegative();

const modelPricingFileSchema = z.array(
  z.object({
    match: z.string().trim().min(1),
    pricing: z.object({
      inputPerMTok: price,
      outputPerMTok: price,
      cacheWritePerMTok: price,
      cacheReadPerMTok: price,
    }),
  }),
);

/** Reads a JSON array of price entries; any read, parse or shape problem stops the startup. */
export function loadModelPricingFile(path: string): ModelPriceEntry[] {
  try {
    return modelPricingFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    const reason = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    throw new Error(`Invalid MODEL_PRICING_FILE "${path}": ${reason}`, { cause: error });
  }
}
