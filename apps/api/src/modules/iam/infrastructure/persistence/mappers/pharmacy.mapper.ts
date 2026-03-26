import type { Pharmacy as PrismaPharmacy } from '@prisma/client';
import { Pharmacy } from '../../../domain/entities/pharmacy.entity';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo';

export class PharmacyMapper {
  static toDomain(record: PrismaPharmacy): Pharmacy {
    return Pharmacy.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      name: record.name,
      slug: record.slug,
      description: record.description ?? undefined,
      address: record.address,
      phone: PhoneNumber.create(record.phone),
      license: record.license ?? undefined,
      logo: record.logo ?? undefined,
      isActive: record.isActive,
      isVerified: record.isVerified,
      deliveryEnabled: record.deliveryEnabled,
      deliveryPrice: record.deliveryPrice ? Number(record.deliveryPrice) : undefined,
      multicardAppId: record.multicardAppId ?? undefined,
      multicardStoreId: record.multicardStoreId ?? undefined,
      multicardSecret: record.multicardSecret ?? undefined,
      deletedAt: record.deletedAt ?? undefined,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(pharmacy: Pharmacy) {
    return {
      id: pharmacy.getId(),
      ownerId: pharmacy.ownerId,
      name: pharmacy.name,
      slug: pharmacy.slug,
      description: pharmacy.description ?? null,
      address: pharmacy.address,
      phone: pharmacy.phone.value,
      license: pharmacy.license ?? null,
      logo: pharmacy.logo ?? null,
      isActive: pharmacy.isActive,
      isVerified: pharmacy.isVerified,
      deliveryEnabled: pharmacy.deliveryEnabled,
      deliveryPrice: pharmacy.deliveryPrice ?? null,
      multicardAppId: pharmacy.multicardAppId ?? null,
      multicardStoreId: pharmacy.multicardStoreId ?? null,
      multicardSecret: pharmacy.multicardSecret ?? null,
    };
  }
}
