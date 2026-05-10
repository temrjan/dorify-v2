import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { MulticardCallbackIpGuard } from '../infrastructure/guards/multicard-callback-ip.guard';
import { config } from '@core/config/env.config';

function makeContext(ip?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as unknown as ExecutionContext;
}

describe('MulticardCallbackIpGuard', () => {
  const guard = new MulticardCallbackIpGuard();
  const allowed = config.MULTICARD_CALLBACK_IPS[0]; // first whitelisted IP

  it('rejects when no client IP resolved', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('rejects unknown IP', () => {
    expect(() => guard.canActivate(makeContext('1.2.3.4'))).toThrow(ForbiddenException);
  });

  it('accepts whitelisted IP', () => {
    expect(guard.canActivate(makeContext(allowed))).toBe(true);
  });

  it('accepts IPv6-mapped IPv4 form', () => {
    // Express returns ::ffff:1.2.3.4 when proxied via IPv6 socket
    expect(guard.canActivate(makeContext(`::ffff:${allowed}`))).toBe(true);
  });
});
