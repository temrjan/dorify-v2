import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { config } from '@core/config/env.config';

/**
 * Validates `X-Service-Token` header for service-to-service calls
 * (e.g. bot → admin/pharmacies/:id/verify). Timing-safe to defeat
 * length-comparison side-channels.
 *
 * Endpoints using this guard MUST be marked `@Public()` to skip the
 * global TelegramAuthGuard (initData irrelevant for service calls).
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  private readonly logger = new Logger(ServiceTokenGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-service-token'] as string | undefined;

    if (!provided) {
      throw new UnauthorizedException('Missing service token');
    }

    const expected = config.ADMIN_SERVICE_TOKEN;
    if (provided.length !== expected.length) {
      this.logger.warn('Service token length mismatch');
      throw new UnauthorizedException('Invalid service token');
    }

    const ok = timingSafeEqual(
      Buffer.from(provided, 'utf8'),
      Buffer.from(expected, 'utf8'),
    );
    if (!ok) {
      this.logger.warn('Service token mismatch');
      throw new UnauthorizedException('Invalid service token');
    }

    return true;
  }
}
