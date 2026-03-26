import { DomainEvent } from '@shared/domain';

export class OrderCancelledEvent extends DomainEvent {
  readonly eventName = 'order.cancelled';

  constructor(
    public readonly payload: {
      orderId: string;
      pharmacyId: string;
      buyerId: string;
      items: Array<{ productId: string; quantity: number }>;
      reason?: string;
    },
  ) {
    super();
  }
}
