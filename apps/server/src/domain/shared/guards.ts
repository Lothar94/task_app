import { AGENT_MODELS, EFFORT_LEVELS, type RunModelChoice } from '@fleet/shared';
import { ValidationError } from '../errors/DomainError.js';

export function requireText(value: string, field: string, maxLength = 20_000): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ValidationError(`${field} is required`);
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

export function requireIntegerInRange(value: number, field: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function optionalOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | null {
  return value === null || value === undefined ? null : requireOneOf(value, field, allowed);
}

/** Each field of an invoker's model choice must be unset or a known model/effort. */
export function requireModelChoice(choice: { model?: unknown; effort?: unknown }): RunModelChoice {
  return {
    model: optionalOneOf(choice.model, 'model', AGENT_MODELS),
    effort: optionalOneOf(choice.effort, 'effort', EFFORT_LEVELS),
  };
}
