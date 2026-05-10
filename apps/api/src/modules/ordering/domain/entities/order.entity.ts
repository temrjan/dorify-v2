import { AggregateRoot } from '@shared/domain';
import { DomainError } from '@shared/domain';
import { Money } from '../../../catalog/domain/value-objects/money.vo';
import type { OrderItem } from './order-item.entity';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderConfirmedEvent } from '../events/order-confirmed.event';
import { OrderCancelledEvent } from '../events/order-cancelled.event';

export enum OrderStatus {
  PENDING = 'PENDING',
  // Manual contact: pharmacy без Multicard creds — buyer заявка, продавец
  // связывается напрямую. Out-transitions wire'аются в Sprint 1 Day 6.
  PENDING_MANUAL_CONTACT = 'PENDING_MANUAL_CONTACT',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  // Manual contact: pharmacy без Multicard. Продавец может принять
  // (CONFIRMED — без оплаты, договорились) либо отказать (CANCELLED).
  [OrderStatus.PENDING_MANUAL_CONTACT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.DELIVERING],
  [OrderStatus.DELIVERING]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PENDING_MANUAL_CONTACT,
  OrderStatus.CONFIRMED,
];

interface OrderProps {
  pharmacyId: string;
  buyerId: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: Money;
  deliveryType: string;
  deliveryAddress?: string;
  contactPhone: string;
  comment?: string;
  createdAt: Date;
}

export class Order extends AggregateRoot<OrderProps> {
  private constructor(id: string, props: OrderProps) {
    super(id, props);
  }

  static create(params: {
    id: string;
    pharmacyId: string;
    buyerId: string;
    items: OrderItem[];
    deliveryType?: string;
    deliveryAddress?: string;
    contactPhone: string;
    comment?: string;
    /**
     * Initial status. PENDING — онлайн-оплата через Multicard;
     * PENDING_MANUAL_CONTACT — заявка для аптек без Multicard creds.
     */
    initialStatus?: OrderStatus.PENDING | OrderStatus.PENDING_MANUAL_CONTACT;
  }): Order {
    if (params.items.length === 0) {
      throw new DomainError('Order must have at least one item');
    }

    const totalAmount = params.items.reduce(
      (sum, item) => sum.add(item.getSubtotal()),
      Money.zero(),
    );

    const initialStatus = params.initialStatus ?? OrderStatus.PENDING;

    const order = new Order(params.id, {
      pharmacyId: params.pharmacyId,
      buyerId: params.buyerId,
      items: params.items,
      status: initialStatus,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount,
      deliveryType: params.deliveryType ?? 'PICKUP',
      deliveryAddress: params.deliveryAddress,
      contactPhone: params.contactPhone,
      comment: params.comment,
      createdAt: new Date(),
    });

    order.addDomainEvent(new OrderCreatedEvent({
      orderId: order.id,
      pharmacyId: params.pharmacyId,
      buyerId: params.buyerId,
      items: params.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      totalAmount: totalAmount.amount,
      contactPhone: params.contactPhone,
      status: initialStatus === OrderStatus.PENDING_MANUAL_CONTACT ? 'PENDING_MANUAL_CONTACT' : 'PENDING',
    }));

    return order;
  }

  static reconstitute(params: {
    id: string;
    pharmacyId: string;
    buyerId: string;
    items: OrderItem[];
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalAmount: Money;
    deliveryType: string;
    deliveryAddress?: string;
    contactPhone: string;
    comment?: string;
    createdAt: Date;
  }): Order {
    return new Order(params.id, { ...params });
  }

  // ── Status transitions ────────────────────────────────────

  confirm(): void {
    if (this.props.status !== OrderStatus.PENDING) {
      throw new DomainError(`Cannot confirm order in status ${this.props.status}`);
    }
    this.props.status = OrderStatus.CONFIRMED;
    this.props.paymentStatus = PaymentStatus.PAID;
    this.touch();

    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.id,
      pharmacyId: this.props.pharmacyId,
      buyerId: this.props.buyerId,
    }));
  }

  cancel(reason?: string): void {
    if (!CANCELLABLE_STATUSES.includes(this.props.status)) {
      throw new DomainError(`Cannot cancel order in status ${this.props.status}`);
    }

    this.props.status = OrderStatus.CANCELLED;
    this.touch();

    this.addDomainEvent(new OrderCancelledEvent({
      orderId: this.id,
      pharmacyId: this.props.pharmacyId,
      buyerId: this.props.buyerId,
      items: this.props.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      reason,
    }));
  }

  updateStatus(newStatus: OrderStatus): void {
    const allowed = VALID_TRANSITIONS[this.props.status];
    if (!allowed?.includes(newStatus)) {
      throw new DomainError(
        `Invalid status transition: ${this.props.status} → ${newStatus}`,
      );
    }
    this.props.status = newStatus;
    this.touch();
  }

  markPaymentFailed(): void {
    this.props.paymentStatus = PaymentStatus.FAILED;
    this.touch();
  }

  // ── Getters ───────────────────────────────────────────────

  get pharmacyId(): string { return this.props.pharmacyId; }
  get buyerId(): string { return this.props.buyerId; }
  get items(): readonly OrderItem[] { return this.props.items; }
  get status(): OrderStatus { return this.props.status; }
  get paymentStatus(): PaymentStatus { return this.props.paymentStatus; }
  get totalAmount(): Money { return this.props.totalAmount; }
  get deliveryType(): string { return this.props.deliveryType; }
  get deliveryAddress(): string | undefined { return this.props.deliveryAddress; }
  get contactPhone(): string { return this.props.contactPhone; }
  get comment(): string | undefined { return this.props.comment; }
  get createdAt(): Date { return this.props.createdAt; }

  isCancellable(): boolean {
    return CANCELLABLE_STATUSES.includes(this.props.status);
  }

  isManualContact(): boolean {
    return this.props.status === OrderStatus.PENDING_MANUAL_CONTACT;
  }
}
