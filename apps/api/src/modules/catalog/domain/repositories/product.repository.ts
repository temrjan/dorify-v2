import type { Product } from '../entities/product.entity';
import type { PaginatedResult, PaginationDto } from '@common/dto/pagination.dto';

export interface ProductListFilters {
  status?: string;
  category?: string;
  search?: string;
  isAvailable?: boolean;
}

export interface RestoreStockItem {
  productId: string;
  quantity: number;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | undefined>;
  findByIds(ids: string[]): Promise<Product[]>;
  findByPharmacyId(pharmacyId: string, filters: ProductListFilters, pagination: PaginationDto): Promise<PaginatedResult<Product>>;
  findPublished(filters: ProductListFilters, pagination: PaginationDto): Promise<PaginatedResult<Product>>;
  findPublishedByPharmacy(pharmacyId: string, filters: ProductListFilters, pagination: PaginationDto): Promise<PaginatedResult<Product>>;
  save(product: Product): Promise<void>;
  /**
   * Atomic stock increment для каждого item — закрывает audit S-HIGH-8.
   * Mirror placeAtomically pattern (prisma-order.repository.ts): UPDATE
   * WHERE через updateMany — без read-modify-write race. Если product
   * удалён (count=0) — silent skip + log, не throw (cancel должен complete).
   */
  restoreStockAtomic(items: RestoreStockItem[]): Promise<void>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
