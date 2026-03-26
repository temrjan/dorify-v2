import { BaseEntity } from '@shared/domain';
import { DomainError } from '@shared/domain';
import { Money } from '../../../catalog/domain/value-objects/money.vo';

interface OrderItemProps {
  productId: string;
  productName: string;
  quantity: number;
  priceAtTime: Money;
}

export class OrderItem extends BaseEntity<OrderItemProps> {
  private constructor(id: string, props: OrderItemProps) {
    super(id, props);
  }

  static create(params: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    priceAtTime: Money;
  }): OrderItem {
    if (params.quantity <= 0) {
      throw new DomainError('Order item quantity must be positive');
    }
    return new OrderItem(params.id, {
      productId: params.productId,
      productName: params.productName,
      quantity: params.quantity,
      priceAtTime: params.priceAtTime,
    });
  }

  static reconstitute(params: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    priceAtTime: Money;
  }): OrderItem {
    return new OrderItem(params.id, {
      productId: params.productId,
      productName: params.productName,
      quantity: params.quantity,
      priceAtTime: params.priceAtTime,
    });
  }

  getSubtotal(): Money {
    return this.props.priceAtTime.multiply(this.props.quantity);
  }

  get productId(): string { return this.props.productId; }
  get productName(): string { return this.props.productName; }
  get quantity(): number { return this.props.quantity; }
  get priceAtTime(): Money { return this.props.priceAtTime; }
}
