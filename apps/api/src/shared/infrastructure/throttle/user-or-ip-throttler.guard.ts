import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface AuthedRequest {
  user?: { id?: unknown };
  ip?: string;
}

/**
 * Per-user (fallback IP) throttler. Default {@link ThrottlerGuard} keys on IP,
 * which breaks for buyers behind carrier CGNAT — one abuser would also throttle
 * unrelated users sharing the gateway. For endpoints sensitive to abuse (image
 * uploads, in particular) we prefer the user.id from `request.user` set by
 * {@link TelegramAuthGuard}. If the request is `@Public()` / unauthenticated,
 * we fall back to IP.
 *
 * Apply via `@UseGuards(UserOrIpThrottlerGuard) + @Throttle({ ... })` per
 * controller route — registering globally would silently rate-limit every
 * endpoint in the API.
 */
@Injectable()
export class UserOrIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: AuthedRequest): Promise<string> {
    const userId = req.user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return Promise.resolve(`user:${userId}`);
    }
    return Promise.resolve(`ip:${req.ip ?? 'unknown'}`);
  }
}
