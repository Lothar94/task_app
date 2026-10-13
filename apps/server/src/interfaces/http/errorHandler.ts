import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Logger } from '../../application/ports/Logger.js';
import { DomainError, type DomainErrorCode } from '../../domain/errors/DomainError.js';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
};

export function createErrorHandler(logger: Logger) {
  return (error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof DomainError) {
      return reply.status(STATUS_BY_CODE[error.code]).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
      return reply.status(400).send({ error: 'Invalid request', details });
    }
    logger.error('Unexpected error handling request', error);
    return reply.status(500).send({ error: 'Internal server error' });
  };
}
