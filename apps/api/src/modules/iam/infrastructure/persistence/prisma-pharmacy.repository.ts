import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import type { PharmacyRepository } from '../../domain/repositories/pharmacy.repository';
import type { Pharmacy } from '../../domain/entities/pharmacy.entity';
import { PharmacyMapper } from './mappers/pharmacy.mapper';

@Injectable()
export class PrismaPharmacyRepository implements PharmacyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Pharmacy | undefined> {
    const record = await this.prisma.pharmacy.findUnique({
      where: { id, deletedAt: null },
    });
    return record ? PharmacyMapper.toDomain(record) : undefined;
  }

  async findByOwnerId(ownerId: string): Promise<Pharmacy | undefined> {
    const record = await this.prisma.pharmacy.findFirst({
      where: { ownerId, deletedAt: null },
    });
    return record ? PharmacyMapper.toDomain(record) : undefined;
  }

  async findBySlug(slug: string): Promise<Pharmacy | undefined> {
    const record = await this.prisma.pharmacy.findFirst({
      where: { slug, deletedAt: null },
    });
    return record ? PharmacyMapper.toDomain(record) : undefined;
  }

  async save(pharmacy: Pharmacy): Promise<void> {
    const data = PharmacyMapper.toPersistence(pharmacy);

    await this.prisma.pharmacy.upsert({
      where: { id: data.id },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        address: data.address,
        phone: data.phone,
        license: data.license,
        logo: data.logo,
        isActive: data.isActive,
        isVerified: data.isVerified,
        deliveryEnabled: data.deliveryEnabled,
        deliveryPrice: data.deliveryPrice,
        multicardAppId: data.multicardAppId,
        multicardStoreId: data.multicardStoreId,
        multicardSecret: data.multicardSecret,
      },
    });
  }
}
