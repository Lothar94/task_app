export type DomainErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(entity: string, id: string) {
    super(`${entity} "${id}" not found`);
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
