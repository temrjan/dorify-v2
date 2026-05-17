import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateId, STORAGE_PORT } from '@shared/domain';
import type { StoragePort } from '@shared/domain';
import { PRODUCT_REPOSITORY } from '../domain/repositories/product.repository';
import type { ProductRepository } from '../domain/repositories/product.repository';
import { Product } from '../domain/entities/product.entity';
import { Money } from '../domain/value-objects/money.vo';
import { Ikpu } from '../domain/value-objects/ikpu.vo';
import { ProductCreatedEvent, ProductHiddenByAdminEvent } from '../domain/events';
import { TenantContext } from '@shared/infrastructure/tenant/tenant.context';
import type { PaginatedResult } from '@common/dto/pagination.dto';
import type {
  CreateProductDto,
  UpdateProductDto,
  ModerateProductDto,
  HideProductDto,
  ProductFiltersDto,
  ProductResponse,
} from './dto/product.dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<ProductResponse> {
    const pharmacyId = TenantContext.requirePharmacyId();

    const product = Product.create({
      id: generateId(),
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

    // Post-moderation MVP: pharmacy is already vetted at registration time,
    // so new products go live immediately. Admin can hide via /admin/products/:id/hide.
    product.autoPublish();
    await this.productRepo.save(product);

    this.emit(new ProductCreatedEvent({
      productId: product.getId(),
      pharmacyId: product.pharmacyId,
      name: product.name,
      price: product.price.amount,
      category: product.category,
    }));

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

  async getMyProduct(productId: string): Promise<ProductResponse> {
    const pharmacyId = TenantContext.requirePharmacyId();
    const product = await this.findOwnedProduct(productId, pharmacyId);
    return this.toResponse(product);
  }

  async listMyProducts(filters: ProductFiltersDto): Promise<PaginatedResult<ProductResponse>> {
    const pharmacyId = TenantContext.requirePharmacyId();

    const result = await this.productRepo.findByPharmacyId(
      pharmacyId,
      { category: filters.category, search: filters.search, status: filters.status },
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

  /**
   * Post-moderation takedown: admin hides a PUBLISHED product (e.g. for
   * violating publication rules). Reason is stored on product.moderationNote
   * and forwarded to the owner via DM. The uploaded image is removed from
   * disk since hidden-by-rules content typically shouldn't keep occupying
   * storage (and may itself be the violation, e.g. inappropriate photo).
   */
  async hideProductByAdmin(productId: string, moderatorId: string, dto: HideProductDto): Promise<ProductResponse> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const imageUrl = product.imageUrl;

    product.hideByAdmin(moderatorId, dto.reason);
    await this.productRepo.save(product);

    this.emit(new ProductHiddenByAdminEvent({
      productId: product.getId(),
      pharmacyId: product.pharmacyId,
      name: product.name,
      reason: dto.reason.trim(),
    }));

    await this.cleanupImage(imageUrl);

    return this.toResponse(product);
  }

  async deleteProduct(productId: string): Promise<void> {
    const pharmacyId = TenantContext.requirePharmacyId();
    const product = await this.findOwnedProduct(productId, pharmacyId);

    // Capture before mutation — hide() doesn't touch imageUrl but a future
    // change might.
    const imageUrl = product.imageUrl;

    if (product.isPublished()) {
      product.hide();
    }

    await this.productRepo.save(product);

    // Pharmacy-initiated delete = clear intent to drop the product. Files
    // produced by /uploads (api.dorify.uz/uploads/products/...) are removed
    // from disk; external URLs are no-op (storage adapter rejects URLs
    // outside its base).
    await this.cleanupImage(imageUrl);
  }

  /**
   * Best-effort image cleanup. Storage adapter is defensive (refuses URLs
   * outside its base, swallows ENOENT, validates traversal) — but we still
   * try/catch so a flaky disk doesn't fail the catalog operation that
   * already committed.
   */
  private async cleanupImage(imageUrl: string | undefined): Promise<void> {
    if (!imageUrl) return;
    try {
      await this.storage.delete(imageUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Image cleanup failed for ${imageUrl}: ${message}`);
    }
  }

  private emit(event: { eventName: string }): void {
    this.eventEmitter.emit(event.eventName, event);
    this.logger.log(`Published event: ${event.eventName}`);
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
      packageCode: product.packageCode,
      vat: product.vat,
      stock: product.stock,
      isAvailable: product.isAvailable,
      requiresPrescription: product.requiresPrescription,
      status: product.status,
      moderationNote: product.moderationNote,
      createdAt: product.createdAt.toISOString(),
    };
  }

}
