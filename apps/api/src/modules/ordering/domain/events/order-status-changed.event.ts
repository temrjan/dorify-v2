import { DomainEvent } from '@shared/domain';
import type { OrderStatus } from '../entities/order.entity';

/**
 * Emitted from `Order.updateStatus()` для всех non-confirm / non-cancel transitions.
 * `confirm()` и `cancel()` сохраняют собственные events (OrderConfirmedEvent /
 * OrderCancelledEvent) для backward compatibility с существующими handlers.
 *
 * Notification handler делает routing буферу DM по `to` status + `deliveryType`.
 */
export class OrderStatusChangedEvent extends DomainEvent {
  readonly eventName = 'order.statusChanged';

  constructor(
    public readonly payload: {
      orderId: string;
      pharmacyId: string;
      buyerId: string;
      from: OrderStatus;
      to: OrderStatus;
      deliveryType: 'PICKUP' | 'DELIVERY';
      deliveryAddress?: string;
    },
  ) {
    super();
  }
}
