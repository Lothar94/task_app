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
