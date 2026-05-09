import { HttpStatus, BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import { DomainError } from '@shared/domain';

interface CapturedResponse {
  statusCode: number;
  message: string;
  errors: unknown;
}

function makeHost(): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 0, message: '', errors: undefined };
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: { message: string; errors: unknown }) {
      captured.message = body.message;
      captured.errors = body.errors;
      return this;
    },
  };
  const request = { method: 'POST', url: '/test' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('maps DomainError → 400 with original message (audit S-CRIT-5)', () => {
    const { host, captured } = makeHost();
    filter.catch(new DomainError('Invalid status transition: PENDING → DELIVERED'), host);
    expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.message).toBe('Invalid status transition: PENDING → DELIVERED');
  });

  it('passes through HttpException status + message', () => {
    const { host, captured } = makeHost();
    filter.catch(new BadRequestException('field required'), host);
    expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.message).toBe('field required');
  });

  it('falls back to 500 for unknown errors', () => {
    const { host, captured } = makeHost();
    filter.catch(new Error('boom'), host);
    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.message).toBe('Internal server error');
  });
});
