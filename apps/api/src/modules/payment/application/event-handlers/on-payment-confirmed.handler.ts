import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_REPOSITORY } from '../../../ordering/domain/repositories/order.repository';
import type { OrderRepository } from '../../../ordering/domain/repositories/order.repository';
import type { PaymentConfirmedEvent } from '../../domain/events/index';

@Injectable()
export class OnPaymentConfirmedHandler {
  private readonly logger = new Logger(OnPaymentConfirmedHandler.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: OrderRepository,
  ) {}

  @OnEvent('payment.confirmed')
  async handle(event: PaymentConfirmedEvent): Promise<void> {
    this.logger.log(`Confirming order ${event.payload.orderId} after payment`);

    const order = await this.orderRepo.findById(event.payload.orderId);
    if (!order) {
      this.logger.error(`Order ${event.payload.orderId} not found`);
      return;
    }

    try {
      order.confirm();
      await this.orderRepo.save(order);
      this.logger.log(`Order ${event.payload.orderId} confirmed`);
    } catch (error) {
      this.logger.error(`Failed to confirm order ${event.payload.orderId}`, error);
    }
  }
}
