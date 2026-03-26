import type { Order } from '../entities/order.entity';
import type { PaginatedResult, PaginationDto } from '@common/dto/pagination.dto';

export interface OrderRepository {
  findById(id: string): Promise<Order | undefined>;
  findByBuyerId(buyerId: string, pagination: PaginationDto): Promise<PaginatedResult<Order>>;
  findByPharmacyId(pharmacyId: string, pagination: PaginationDto): Promise<PaginatedResult<Order>>;
  save(order: Order): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
