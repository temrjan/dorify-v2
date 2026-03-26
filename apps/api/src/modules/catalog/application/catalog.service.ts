import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from '../domain/repositories/product.repository';
import type { ProductRepository } from '../domain/repositories/product.repository';
import { Product } from '../domain/entities/product.entity';
import { Money } from '../domain/value-objects/money.vo';
import { Ikpu } from '../domain/value-objects/ikpu.vo';
import { TenantContext } from '@shared/infrastructure/tenant/tenant.context';
import type { PaginatedResult } from '@common/dto/pagination.dto';
import type {
  CreateProductDto,
  UpdateProductDto,
  ModerateProductDto,
  ProductFiltersDto,
  ProductResponse,
} from './dto/product.dto';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<ProductResponse> {
    const pharmacyId = TenantContext.requirePharmacyId();

    const product = Product.create({
      id: this.generateCuid(),
      pharmacyId,
      name: dto.name,
      description: dto.description,
      activeSubstance: dto.activeSubstance,
      manufacturer: dto.manufacturer,
      barcode: dto.barcode,
      category: dto.category,
      price: Money.create(dto.price),
      imageUrl: dto.imageUrl,
      ikpu: dto.ikpu ? Ikpu.create(dto.ikpu) : undefined,
      packageCode: dto.packageCode,
      vat: dto.vat,
      stock: dto.stock,
      requiresPrescription: dto.requiresPrescription,
    });

    product.submitForModeration();
    await this.productRepo.save(product);

    return this.toResponse(product);
  }

  async updateProduct(productId: string, dto: UpdateProductDto): Promise<ProductResponse> {
    const pharmacyId = TenantContext.requirePharmacyId();
    const product = await this.findOwnedProduct(productId, pharmacyId);

    product.updateDetails({
      name: dto.name,
      description: dto.description,
      activeSubstance: dto.activeSubstance,
      manufacturer: dto.manufacturer,
      barcode: dto.barcode,
      category: dto.category,
      imageUrl: dto.imageUrl,
      requiresPrescription: dto.requiresPrescription,
    });

    if (dto.price !== undefined) {
      product.updatePrice(Money.create(dto.price));
    }
    if (dto.stock !== undefined) {
      product.updateStock(dto.stock);
    }
    if (dto.ikpu !== undefined || dto.packageCode !== undefined || dto.vat !== undefined) {
      product.updateOfd({
        ikpu: dto.ikpu ? Ikpu.create(dto.ikpu) : undefined,
        packageCode: dto.packageCode,
        vat: dto.vat,
      });
    }

    await this.productRepo.save(product);
    return this.toResponse(product);
  }

  async getProduct(productId: string): Promise<ProductResponse> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return this.toResponse(product);
  }

  async listMyProducts(filters: ProductFiltersDto): Promise<PaginatedResult<ProductResponse>> {
    const pharmacyId = TenantContext.requirePharmacyId();

    const result = await this.productRepo.findByPharmacyId(
      pharmacyId,
      { category: filters.category, search: filters.search },
      { page: filters.page, limit: filters.limit },
    );

    return {
      ...result,
      items: result.items.map((p) => this.toResponse(p)),
    };
  }

  async listPublicProducts(filters: ProductFiltersDto): Promise<PaginatedResult<ProductResponse>> {
    const result = await this.productRepo.findPublished(
      { category: filters.category, search: filters.search },
      { page: filters.page, limit: filters.limit },
    );

    return {
      ...result,
      items: result.items.map((p) => this.toResponse(p)),
    };
  }

  async listPharmacyProducts(pharmacyId: string, filters: ProductFiltersDto): Promise<PaginatedResult<ProductResponse>> {
    const result = await this.productRepo.findPublishedByPharmacy(
      pharmacyId,
      { category: filters.category, search: filters.search },
      { page: filters.page, limit: filters.limit },
    );

    return {
      ...result,
      items: result.items.map((p) => this.toResponse(p)),
    };
  }

  async moderateProduct(productId: string, moderatorId: string, dto: ModerateProductDto): Promise<ProductResponse> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (dto.action === 'publish') {
      product.publish(moderatorId);
    } else {
      if (!dto.note) {
        throw new ForbiddenException('Rejection note is required');
      }
      product.reject(moderatorId, dto.note);
    }

    await this.productRepo.save(product);
    return this.toResponse(product);
  }

  async deleteProduct(productId: string): Promise<void> {
    const pharmacyId = TenantContext.requirePharmacyId();
    const product = await this.findOwnedProduct(productId, pharmacyId);

    if (product.isPublished()) {
      product.hide();
    }

    await this.productRepo.save(product);
  }

  private async findOwnedProduct(productId: string, pharmacyId: string): Promise<Product> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (product.pharmacyId !== pharmacyId) {
      throw new ForbiddenException('Product does not belong to your pharmacy');
    }
    return product;
  }

  private toResponse(product: Product): ProductResponse {
    return {
      id: product.getId(),
      pharmacyId: product.pharmacyId,
      name: product.name,
      description: product.description,
      activeSubstance: product.activeSubstance,
      manufacturer: product.manufacturer,
      barcode: product.barcode,
      category: product.category,
      price: product.price.amount,
      imageUrl: product.imageUrl,
      ikpu: product.ikpu?.code,
      vat: product.vat,
      stock: product.stock,
      isAvailable: product.isAvailable,
      requiresPrescription: product.requiresPrescription,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
  }
}
