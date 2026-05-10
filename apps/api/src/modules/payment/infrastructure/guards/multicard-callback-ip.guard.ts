import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { config } from '@core/config/env.config';

/**
 * Validates that Multicard callback request originates from whitelisted IP
 * (audit S-CRIT-4). MD5 signature alone не достаточна — IP whitelist
 * закрывает callback flooding и replay attacks от non-Multicard sources.
 *
 * Behind Caddy: `request.ip` resolves via X-Forwarded-For thanks to
 * `app.set('trust proxy', 1)` в main.ts.
 */
@Injectable()
export class MulticardCallbackIpGuard implements CanActivate {
  private readonly logger = new Logger(MulticardCallbackIpGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = request.ip;

    if (!clientIp) {
      this.logger.warn('Callback rejected: no client IP resolved');
      throw new ForbiddenException('Forbidden');
    }

    // Strip IPv6-mapped IPv4 prefix (::ffff:1.2.3.4 → 1.2.3.4) for plain string compare.
    const normalized = clientIp.replace(/^::ffff:/, '');

    if (!config.MULTICARD_CALLBACK_IPS.includes(normalized)) {
      this.logger.warn(
        `Callback rejected from ${normalized}; whitelist=${config.MULTICARD_CALLBACK_IPS.join(',')}`,
      );
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
