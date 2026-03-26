import type { User } from '../entities/user.entity';
import type { TelegramId } from '../value-objects/telegram-id.vo';

export interface UserRepository {
  findById(id: string): Promise<User | undefined>;
  findByTelegramId(telegramId: TelegramId): Promise<User | undefined>;
  save(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
