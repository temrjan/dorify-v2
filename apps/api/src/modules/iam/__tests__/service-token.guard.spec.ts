import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ServiceTokenGuard } from '../infrastructure/guards/service-token.guard';
import { config } from '@core/config/env.config';

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceTokenGuard', () => {
  const guard = new ServiceTokenGuard();
  const expectedToken = config.ADMIN_SERVICE_TOKEN;

  it('rejects request without token header', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects token of wrong length', () => {
    expect(() => guard.canActivate(makeContext({ 'x-service-token': 'short' })))
      .toThrow(UnauthorizedException);
  });

  it('rejects mismatched token of correct length', () => {
    const wrong = 'z'.repeat(expectedToken.length);
    if (wrong === expectedToken) {
      throw new Error('Test setup invalid: random token collision');
    }
    expect(() => guard.canActivate(makeContext({ 'x-service-token': wrong })))
      .toThrow(UnauthorizedException);
  });

  it('accepts matching token', () => {
    expect(guard.canActivate(makeContext({ 'x-service-token': expectedToken }))).toBe(true);
  });
});
