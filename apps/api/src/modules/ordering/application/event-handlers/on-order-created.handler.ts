import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PRODUCT_REPOSITORY } from '../../../catalog/domain/repositories/product.repository';
import type { ProductRepository } from '../../../catalog/domain/repositories/product.repository';
import type { OrderCreatedEvent } from '../../domain/events/order-created.event';

@Injectable()
export class OnOrderCreatedDecrementStock {
  private readonly logger = new Logger(OnOrderCreatedDecrementStock.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
  ) {}

  @OnEvent('order.created')
  async handle(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(`Decrementing stock for order ${event.payload.orderId}`);

    for (const item of event.payload.items) {
      const product = await this.productRepo.findById(item.productId);
      if (product) {
        product.decrementStock(item.quantity);
        await this.productRepo.save(product);
        this.logger.log(`Stock decremented: ${product.name} -${item.quantity} → ${product.stock}`);
      }
    }
  }
}
