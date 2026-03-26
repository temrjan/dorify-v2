import { DomainEvent } from '@shared/domain';

export class OrderCreatedEvent extends DomainEvent {
  readonly eventName = 'order.created';

  constructor(
    public readonly payload: {
      orderId: string;
      pharmacyId: string;
      buyerId: string;
      items: Array<{ productId: string; quantity: number }>;
      totalAmount: number;
    },
  ) {
    super();
  }
}
