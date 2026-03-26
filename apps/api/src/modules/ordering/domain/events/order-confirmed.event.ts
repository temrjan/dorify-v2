import { DomainEvent } from '@shared/domain';

export class OrderConfirmedEvent extends DomainEvent {
  readonly eventName = 'order.confirmed';

  constructor(
    public readonly payload: {
      orderId: string;
      pharmacyId: string;
      buyerId: string;
    },
  ) {
    super();
  }
}
