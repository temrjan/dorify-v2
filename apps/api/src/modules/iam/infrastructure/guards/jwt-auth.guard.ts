import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { config } from '@core/config/env.config';
import { UserRole } from '@common/decorators/roles.decorator';

interface JwtPayload {
  sub: string;
  role: UserRole;
  pharmacyId?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

      request.user = {
        id: payload.sub,
        role: payload.role,
        pharmacyId: payload.pharmacyId,
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      this.logger.warn('JWT verification failed');
      throw new UnauthorizedException('Invalid token');
    }
  }
}
