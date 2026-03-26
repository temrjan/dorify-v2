import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import type { ProductRepository, ProductListFilters } from '../../domain/repositories/product.repository';
import type { Product } from '../../domain/entities/product.entity';
import type { PaginatedResult, PaginationDto } from '@common/dto/pagination.dto';
import { ProductMapper } from './mappers/product.mapper';
import type { Prisma, ProductStatus } from '@prisma/client';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | undefined> {
    const record = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });
    return record ? ProductMapper.toDomain(record) : undefined;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const records = await this.prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
    return records.map(ProductMapper.toDomain);
  }

  async findByPharmacyId(
    pharmacyId: string,
    filters: ProductListFilters,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Product>> {
    const where = this.buildWhere({ ...filters, pharmacyId });

    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: records.map(ProductMapper.toDomain),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findPublished(
    filters: ProductListFilters,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Product>> {
    const where = this.buildWhere({ ...filters, status: 'PUBLISHED', isAvailable: true });

    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: records.map(ProductMapper.toDomain),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findPublishedByPharmacy(
    pharmacyId: string,
    filters: ProductListFilters,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Product>> {
    return this.findPublished({ ...filters, pharmacyId } as ProductListFilters & { pharmacyId: string }, pagination);
  }

  async save(product: Product): Promise<void> {
    const data = ProductMapper.toPersistence(product);

    await this.prisma.product.upsert({
      where: { id: data.id },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        activeSubstance: data.activeSubstance,
        manufacturer: data.manufacturer,
        barcode: data.barcode,
        category: data.category,
        price: data.price,
        imageUrl: data.imageUrl,
        ikpu: data.ikpu,
        packageCode: data.packageCode,
        vat: data.vat,
        stock: data.stock,
        isAvailable: data.isAvailable,
        requiresPrescription: data.requiresPrescription,
        status: data.status,
        moderatedBy: data.moderatedBy,
        moderatedAt: data.moderatedAt,
        moderationNote: data.moderationNote,
      },
    });
  }

  private buildWhere(filters: ProductListFilters & { pharmacyId?: string }): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (filters.pharmacyId) where.pharmacyId = filters.pharmacyId;
    if (filters.status) where.status = filters.status as ProductStatus;
    if (filters.isAvailable !== undefined) where.isAvailable = filters.isAvailable;
    if (filters.category) where.category = filters.category;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { activeSubstance: { contains: filters.search, mode: 'insensitive' } },
        { manufacturer: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
