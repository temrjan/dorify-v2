import type { User as PrismaUser } from '@prisma/client';
import { User } from '../../../domain/entities/user.entity';
import { TelegramId } from '../../../domain/value-objects/telegram-id.vo';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo';
import { UserRole } from '@common/decorators/roles.decorator';

export class UserMapper {
  static toDomain(record: PrismaUser & { pharmacy?: { id: string } | null }): User {
    return User.reconstitute({
      id: record.id,
      telegramId: TelegramId.create(record.telegramId),
      firstName: record.firstName,
      lastName: record.lastName ?? undefined,
      username: record.username ?? undefined,
      languageCode: record.languageCode ?? undefined,
      phone: record.phone ? PhoneNumber.create(record.phone) : undefined,
      role: record.role as UserRole,
      isBanned: record.isBanned,
      pharmacyId: record.pharmacy?.id,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(user: User): {
    id: string;
    telegramId: bigint;
    firstName: string;
    lastName: string | null;
    username: string | null;
    languageCode: string | null;
    phone: string | null;
    role: string;
    isBanned: boolean;
  } {
    return {
      id: user.getId(),
      telegramId: user.telegramId.value,
      firstName: user.firstName,
      lastName: user.lastName ?? null,
      username: user.username ?? null,
      languageCode: user.languageCode ?? null,
      phone: user.phone?.value ?? null,
      role: user.role,
      isBanned: user.isBanned,
    };
  }
}
