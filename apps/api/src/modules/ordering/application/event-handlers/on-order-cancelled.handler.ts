import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PRODUCT_REPOSITORY } from '../../../catalog/domain/repositories/product.repository';
import type { ProductRepository } from '../../../catalog/domain/repositories/product.repository';
import type { OrderCancelledEvent } from '../../domain/events/order-cancelled.event';

@Injectable()
export class OnOrderCancelledRestoreStock {
  private readonly logger = new Logger(OnOrderCancelledRestoreStock.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
  ) {}

  @OnEvent('order.cancelled')
  async handle(event: OrderCancelledEvent): Promise<void> {
    this.logger.log(
      `Restoring stock for cancelled order ${event.payload.orderId} (${event.payload.items.length} items)`,
    );

    // Atomic increment per item — closes audit S-HIGH-8: prior read-modify-write
    // (findById → restoreStock → save) had race window для concurrent cancellations
    // того же order. updateMany WHERE — atomic at DB level.
    await this.productRepo.restoreStockAtomic(event.payload.items);
  }
}
