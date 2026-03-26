import type { Product as PrismaProduct } from '@prisma/client';
import { Product, ProductStatus } from '../../../domain/entities/product.entity';
import { Money } from '../../../domain/value-objects/money.vo';
import { Ikpu } from '../../../domain/value-objects/ikpu.vo';

export class ProductMapper {
  static toDomain(record: PrismaProduct): Product {
    return Product.reconstitute({
      id: record.id,
      pharmacyId: record.pharmacyId,
      name: record.name,
      description: record.description ?? undefined,
      activeSubstance: record.activeSubstance ?? undefined,
      manufacturer: record.manufacturer ?? undefined,
      barcode: record.barcode ?? undefined,
      category: record.category ?? undefined,
      price: Money.create(Number(record.price)),
      imageUrl: record.imageUrl ?? undefined,
      ikpu: record.ikpu ? Ikpu.create(record.ikpu) : undefined,
      packageCode: record.packageCode ?? undefined,
      vat: record.vat ?? undefined,
      stock: record.stock,
      isAvailable: record.isAvailable,
      requiresPrescription: record.requiresPrescription,
      status: record.status as ProductStatus,
      moderatedBy: record.moderatedBy ?? undefined,
      moderatedAt: record.moderatedAt ?? undefined,
      moderationNote: record.moderationNote ?? undefined,
      deletedAt: record.deletedAt ?? undefined,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(product: Product) {
    return {
      id: product.getId(),
      pharmacyId: product.pharmacyId,
      name: product.name,
      description: product.description ?? null,
      activeSubstance: product.activeSubstance ?? null,
      manufacturer: product.manufacturer ?? null,
      barcode: product.barcode ?? null,
      category: product.category ?? null,
      price: product.price.amount,
      imageUrl: product.imageUrl ?? null,
      ikpu: product.ikpu?.code ?? null,
      packageCode: product.packageCode ?? null,
      vat: product.vat ?? null,
      stock: product.stock,
      isAvailable: product.isAvailable,
      requiresPrescription: product.requiresPrescription,
      status: product.status,
      moderatedBy: product.moderatedBy ?? null,
      moderatedAt: product.moderatedAt ?? null,
      moderationNote: product.moderationNote ?? null,
    };
  }
}
