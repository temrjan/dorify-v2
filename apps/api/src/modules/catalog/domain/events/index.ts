import { DomainEvent } from '@shared/domain';

export class ProductCreatedEvent extends DomainEvent {
  readonly eventName = 'product.created';

  constructor(
    public readonly payload: {
      productId: string;
      pharmacyId: string;
      name: string;
      price: number;
      category?: string;
    },
  ) {
    super();
  }
}

export class ProductHiddenByAdminEvent extends DomainEvent {
  readonly eventName = 'product.hiddenByAdmin';

  constructor(
    public readonly payload: {
      productId: string;
      pharmacyId: string;
      name: string;
      reason: string;
    },
  ) {
    super();
  }
}

export class StockDecrementedEvent extends DomainEvent {
  readonly eventName = 'stock.decremented';

  constructor(
    public readonly payload: {
      productId: string;
      quantity: number;
      remainingStock: number;
    },
  ) {
    super();
  }
}

export class StockRestoredEvent extends DomainEvent {
  readonly eventName = 'stock.restored';

  constructor(
    public readonly payload: {
      productId: string;
      quantity: number;
      newStock: number;
    },
  ) {
    super();
  }
}
