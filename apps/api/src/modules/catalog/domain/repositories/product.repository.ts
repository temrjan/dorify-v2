import type { Product } from '../entities/product.entity';
import type { PaginatedResult, PaginationDto } from '@common/dto/pagination.dto';

export interface ProductListFilters {
  status?: string;
  category?: string;
  search?: string;
  isAvailable?: boolean;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | undefined>;
  findByIds(ids: string[]): Promise<Product[]>;
  findByPharmacyId(pharmacyId: string, filters: ProductListFilters, pagination: PaginationDto): Promise<PaginatedResult<Product>>;
  findPublished(filters: ProductListFilters, pagination: PaginationDto): Promise<PaginatedResult<Product>>;
  findPublishedByPharmacy(pharmacyId: string, filters: ProductListFilters, pagination: PaginationDto): Promise<PaginatedResult<Product>>;
  save(product: Product): Promise<void>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
