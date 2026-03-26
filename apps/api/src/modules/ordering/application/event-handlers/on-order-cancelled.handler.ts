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
    this.logger.log(`Restoring stock for cancelled order ${event.payload.orderId}`);

    for (const item of event.payload.items) {
      const product = await this.productRepo.findById(item.productId);
      if (product) {
        product.restoreStock(item.quantity);
        await this.productRepo.save(product);
        this.logger.log(`Stock restored: ${product.name} +${item.quantity} → ${product.stock}`);
      }
    }
  }
}
