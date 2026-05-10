import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { OrderCreatedEvent } from '../../domain/events/order-created.event';

/**
 * Stock decrement is now handled atomically in OrderRepository.placeAtomically()
 * (audit S-HIGH-4 fix — prevents lost-update race). This handler stays as a
 * lightweight observer для logging / future side-effects (e.g. analytics).
 */
@Injectable()
export class OnOrderCreatedDecrementStock {
  private readonly logger = new Logger(OnOrderCreatedDecrementStock.name);

  @OnEvent('order.created')
  handle(event: OrderCreatedEvent): void {
    this.logger.log(
      `Order ${event.payload.orderId} created (status=${event.payload.status}); stock decrement already applied atomically.`,
    );
  }
}
