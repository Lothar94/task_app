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
    if (isClientError(error)) {
      return reply.status(error.statusCode).send({ error: clientMessage(error) });
    }
    logger.error('Unexpected error handling request', error);
    return reply.status(500).send({ error: 'Internal server error' });
  };
}

function isClientError(error: FastifyError | Error): error is FastifyError & { statusCode: number } {
  const { statusCode } = error as FastifyError;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

function clientMessage(error: FastifyError): string {
  if (error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') return 'Request body must not be empty';
  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error instanceof SyntaxError) {
    return 'Request body is not valid JSON';
  }
  return error.message;
}
