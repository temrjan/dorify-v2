import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '@shared/domain';

/** Headers that may carry credentials/identity — must never reach logs. */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-telegram-initdata',
  'x-service-token',
  'x-api-key',
]);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errors } = this.extractError(exception);

    // Log 4xx как warn (client fault, не alerting), 5xx как error.
    const isClientError = status >= 400 && status < 500;
    const logFn = isClientError
      ? this.logger.warn.bind(this.logger)
      : this.logger.error.bind(this.logger);
    const scrubbedHeaders = this.scrubHeaders(request.headers);
    logFn(
      `${request.method} ${request.url} ${status} headers=${JSON.stringify(scrubbedHeaders)}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private extractError(exception: unknown): {
    status: number;
    message: string;
    errors: unknown;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      return {
        status: exception.getStatus(),
        message:
          typeof response === 'string'
            ? response
            : (response as Record<string, unknown>).message as string,
        errors: (response as Record<string, unknown>).errors,
      };
    }
    // Audit S-CRIT-5: business-rule violations are client-side errors,
    // not server faults. Return 400 with the domain message so frontend
    // can show meaningful validation feedback.
    if (exception instanceof DomainError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: exception.message,
        errors: undefined,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: undefined,
    };
  }

  /**
   * Redact credentials/identity headers (audit P4.1). Returns a shallow copy —
   * the request object itself is untouched.
   */
  private scrubHeaders(headers: Request['headers']): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(headers)) {
      out[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[REDACTED]' : value;
    }
    return out;
  }
}
