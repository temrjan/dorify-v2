import type { Order } from '../entities/order.entity';
import type { PaginatedResult, PaginationDto } from '@common/dto/pagination.dto';

export class InsufficientStockError extends Error {
  constructor(public readonly productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = 'InsufficientStockError';
  }
}

export interface OrderRepository {
  findById(id: string): Promise<Order | undefined>;
  findByBuyerId(buyerId: string, pagination: PaginationDto): Promise<PaginatedResult<Order>>;
  findByPharmacyId(pharmacyId: string, pagination: PaginationDto): Promise<PaginatedResult<Order>>;
  save(order: Order): Promise<void>;

  /**
   * Atomically decrements stock на all items + creates order в single
   * transaction. Throws `InsufficientStockError` (rolling back tx) если
   * любой product has insufficient stock OR not available. Closes audit
   * S-HIGH-4 race condition (placeOrder validation + stock decrement
   * не были атомарны).
   */
  placeAtomically(order: Order): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
