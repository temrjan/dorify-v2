import { DomainEvent } from '@shared/domain';

export class PaymentConfirmedEvent extends DomainEvent {
  readonly eventName = 'payment.confirmed';

  constructor(
    public readonly payload: {
      paymentId: string;
      orderId: string;
      pharmacyId: string;
      amount: number;
    },
  ) {
    super();
  }
}

export class PaymentFailedEvent extends DomainEvent {
  readonly eventName = 'payment.failed';

  constructor(
    public readonly payload: {
      paymentId: string;
      orderId: string;
      pharmacyId: string;
      reason?: string;
    },
  ) {
    super();
  }
}
