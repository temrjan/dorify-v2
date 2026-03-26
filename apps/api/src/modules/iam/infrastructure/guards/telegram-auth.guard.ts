import { Injectable, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'crypto';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { config } from '@core/config/env.config';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { TelegramId } from '../../domain/value-objects/telegram-id.vo';
import { User } from '../../domain/entities/user.entity';

interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const initData = request.headers['x-telegram-initdata'] as string | undefined;

    if (!initData) {
      throw new UnauthorizedException('Missing Telegram initData');
    }

    const validated = this.validateInitData(initData);
    if (!validated) {
      throw new UnauthorizedException('Invalid Telegram initData');
    }

    const user = await this.findOrCreateUser(validated);
    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    request.user = {
      id: user.getId(),
      telegramId: user.telegramId.value.toString(),
      role: user.role,
      pharmacyId: user.pharmacyId,
    };

    return true;
  }

  private validateInitData(initData: string): TelegramUserData | undefined {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) return undefined;

      // Check TTL
      const authDate = Number(params.get('auth_date'));
      if (!authDate) return undefined;

      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > config.INIT_DATA_TTL_SECONDS) {
        this.logger.warn('Telegram initData expired');
        return undefined;
      }

      // Verify HMAC
      params.delete('hash');
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = createHmac('sha256', 'WebAppData')
        .update(config.BOT_TOKEN)
        .digest();

      const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (calculatedHash !== hash) {
        this.logger.warn('Telegram initData HMAC mismatch');
        return undefined;
      }

      // Parse user
      const userParam = params.get('user');
      if (!userParam) return undefined;

      return JSON.parse(userParam) as TelegramUserData;
    } catch (error) {
      this.logger.error('Failed to validate initData', error);
      return undefined;
    }
  }

  private async findOrCreateUser(telegramUser: TelegramUserData): Promise<User> {
    const telegramId = TelegramId.create(telegramUser.id);
    const existing = await this.userRepo.findByTelegramId(telegramId);

    if (existing) {
      // Update profile if name changed
      if (
        existing.firstName !== telegramUser.first_name ||
        existing.lastName !== telegramUser.last_name ||
        existing.username !== telegramUser.username
      ) {
        existing.updateProfile({
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
        });
        await this.userRepo.save(existing);
      }
      return existing;
    }

    // Create new user
    const user = User.create({
      id: this.generateCuid(),
      telegramId,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      languageCode: telegramUser.language_code,
    });

    await this.userRepo.save(user);
    this.logger.log(`New user registered: ${user.displayName} (${telegramUser.id})`);

    return user;
  }

  private generateCuid(): string {
    // Simple cuid-like ID generation
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
  }
}
