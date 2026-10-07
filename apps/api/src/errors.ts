import { TransitionError } from '@tmh/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError, type z } from 'zod';
import { env } from './env';

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message);
export const unauthorized = (message = 'Please sign in again.') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message: string, code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (what = 'That') => new AppError(404, 'NOT_FOUND', `${what} was not found.`);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);

/** Parses input with a Zod schema; failures become 400 VALIDATION_ERROR. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}

/** Validates an outgoing payload against its contract schema in dev/test. */
export function out<S extends z.ZodType>(schema: S, data: z.input<S>): z.output<S> {
  return env.validateResponses ? schema.parse(data) : (data as z.output<S>);
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      const field = first?.path.length ? `${first.path.join('.')}: ` : '';
      return reply
        .status(400)
        .send({ error: 'VALIDATION_ERROR', message: `${field}${first?.message ?? 'Invalid input'}`, details: error.issues });
    }
    if (error instanceof TransitionError) {
      return reply.status(409).send({ error: 'INVALID_TRANSITION', message: error.message });
    }
    const fe = error as FastifyError;
    if (fe.statusCode && fe.statusCode < 500) {
      return reply.status(fe.statusCode).send({ error: fe.code ?? 'BAD_REQUEST', message: fe.message });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: 'NOT_FOUND', message: `No route for ${request.method} ${request.url}` }),
  );
}
