import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { User } from '../../domain/entities/user.entity';
import type { TelegramId } from '../../domain/value-objects/telegram-id.vo';
import { UserMapper } from './mappers/user.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | undefined> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { pharmacy: { select: { id: true } } },
    });
    return record ? UserMapper.toDomain(record) : undefined;
  }

  async findByTelegramId(telegramId: TelegramId): Promise<User | undefined> {
    const record = await this.prisma.user.findUnique({
      where: { telegramId: telegramId.value },
      include: { pharmacy: { select: { id: true } } },
    });
    return record ? UserMapper.toDomain(record) : undefined;
  }

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);

    await this.prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        languageCode: data.languageCode,
        phone: data.phone,
        role: data.role,
        isBanned: data.isBanned,
      },
    });
  }
}
