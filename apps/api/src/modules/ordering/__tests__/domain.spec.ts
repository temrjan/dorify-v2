import { Order, OrderStatus, PaymentStatus } from '../domain/entities/order.entity';
import { OrderItem } from '../domain/entities/order-item.entity';
import { Money } from '../../catalog/domain/value-objects/money.vo';
import { OrderCreatedEvent } from '../domain/events/order-created.event';
import { OrderConfirmedEvent } from '../domain/events/order-confirmed.event';
import { OrderCancelledEvent } from '../domain/events/order-cancelled.event';

// ── Helpers ─────────────────────────────────────────────────

const createItem = (overrides?: Partial<{ productId: string; name: string; quantity: number; price: number }>) =>
  OrderItem.create({
    id: `item-${Math.random().toString(36).slice(2, 6)}`,
    productId: overrides?.productId ?? 'prod-1',
    productName: overrides?.name ?? 'Парацетамол 500мг',
    quantity: overrides?.quantity ?? 2,
    priceAtTime: Money.create(overrides?.price ?? 15000),
  });

const createOrder = (overrides?: { items?: OrderItem[] }) => {
  const items = overrides?.items ?? [
    createItem({ productId: 'prod-1', name: 'Парацетамол', quantity: 2, price: 15000 }),
    createItem({ productId: 'prod-2', name: 'Ибупрофен', quantity: 1, price: 25000 }),
  ];

  return Order.create({
    id: 'order-1',
    pharmacyId: 'pharmacy-1',
    buyerId: 'user-1',
    items,
    contactPhone: '+998901234567',
  });
};

// ── OrderItem ───────────────────────────────────────────────

describe('OrderItem', () => {
  it('should create with correct subtotal', () => {
    const item = createItem({ quantity: 3, price: 10000 });
    expect(item.getSubtotal().amount).toBe(30000);
  });

  it('should reject zero quantity', () => {
    expect(() => createItem({ quantity: 0 })).toThrow('must be positive');
  });

  it('should reject negative quantity', () => {
    expect(() => createItem({ quantity: -1 })).toThrow('must be positive');
  });
});

// ── Order Aggregate ─────────────────────────────────────────

describe('Order', () => {
  // ── Creation ──────────────────────────────────────────

  it('should create with PENDING status', () => {
    const order = createOrder();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
  });

  it('should calculate correct total', () => {
    const order = createOrder();
    // 15000*2 + 25000*1 = 55000
    expect(order.totalAmount.amount).toBe(55000);
  });

  it('should emit OrderCreatedEvent', () => {
    const order = createOrder();
    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    expect((events[0] as OrderCreatedEvent).payload.orderId).toBe('order-1');
    expect((events[0] as OrderCreatedEvent).payload.items).toHaveLength(2);
  });

  it('should clear events after pull', () => {
    const order = createOrder();
    order.pullDomainEvents();
    expect(order.pullDomainEvents()).toHaveLength(0);
  });

  it('should reject empty items', () => {
    expect(() => createOrder({ items: [] })).toThrow('at least one item');
  });

  // ── Confirm ───────────────────────────────────────────

  it('should confirm from PENDING', () => {
    const order = createOrder();
    order.pullDomainEvents(); // clear creation event
    order.confirm();
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);

    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderConfirmedEvent);
  });

  it('should not confirm from CANCELLED', () => {
    const order = createOrder();
    order.cancel();
    expect(() => order.confirm()).toThrow('Cannot confirm');
  });

  // ── Cancel ────────────────────────────────────────────

  it('should cancel from PENDING', () => {
    const order = createOrder();
    order.pullDomainEvents();
    order.cancel('Changed my mind');

    expect(order.status).toBe(OrderStatus.CANCELLED);

    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderCancelledEvent);

    const cancelled = events[0] as OrderCancelledEvent;
    expect(cancelled.payload.reason).toBe('Changed my mind');
    expect(cancelled.payload.items).toHaveLength(2);
  });

  it('should cancel from CONFIRMED', () => {
    const order = createOrder();
    order.confirm();
    order.pullDomainEvents();
    order.cancel();
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });

  it('should not cancel from PREPARING', () => {
    const order = createOrder();
    order.confirm();
    order.updateStatus(OrderStatus.PREPARING);
    expect(() => order.cancel()).toThrow('Cannot cancel');
  });

  it('should not cancel from DELIVERED', () => {
    const order = createOrder();
    order.confirm();
    order.updateStatus(OrderStatus.PREPARING);
    order.updateStatus(OrderStatus.READY);
    order.updateStatus(OrderStatus.DELIVERING);
    order.updateStatus(OrderStatus.DELIVERED);
    expect(() => order.cancel()).toThrow('Cannot cancel');
  });

  // ── Status transitions (state machine) ────────────────

  it('should follow full lifecycle: PENDING → CONFIRMED → PREPARING → READY → DELIVERING → DELIVERED', () => {
    const order = createOrder();
    order.confirm();
    expect(order.status).toBe(OrderStatus.CONFIRMED);

    order.updateStatus(OrderStatus.PREPARING);
    expect(order.status).toBe(OrderStatus.PREPARING);

    order.updateStatus(OrderStatus.READY);
    expect(order.status).toBe(OrderStatus.READY);

    order.updateStatus(OrderStatus.DELIVERING);
    expect(order.status).toBe(OrderStatus.DELIVERING);

    order.updateStatus(OrderStatus.DELIVERED);
    expect(order.status).toBe(OrderStatus.DELIVERED);
  });

  it('should reject invalid transition PENDING → DELIVERED', () => {
    const order = createOrder();
    expect(() => order.updateStatus(OrderStatus.DELIVERED)).toThrow('Invalid status transition');
  });

  it('should reject invalid transition PENDING → PREPARING', () => {
    const order = createOrder();
    expect(() => order.updateStatus(OrderStatus.PREPARING)).toThrow('Invalid status transition');
  });

  it('should reject transition from DELIVERED', () => {
    const order = createOrder();
    order.confirm();
    order.updateStatus(OrderStatus.PREPARING);
    order.updateStatus(OrderStatus.READY);
    order.updateStatus(OrderStatus.DELIVERING);
    order.updateStatus(OrderStatus.DELIVERED);
    expect(() => order.updateStatus(OrderStatus.CANCELLED)).toThrow('Invalid status transition');
  });

  it('should reject transition from CANCELLED', () => {
    const order = createOrder();
    order.cancel();
    expect(() => order.updateStatus(OrderStatus.CONFIRMED)).toThrow('Invalid status transition');
  });

  // ── isCancellable ─────────────────────────────────────

  it('should be cancellable when PENDING', () => {
    const order = createOrder();
    expect(order.isCancellable()).toBe(true);
  });

  it('should be cancellable when CONFIRMED', () => {
    const order = createOrder();
    order.confirm();
    expect(order.isCancellable()).toBe(true);
  });

  it('should not be cancellable when PREPARING', () => {
    const order = createOrder();
    order.confirm();
    order.updateStatus(OrderStatus.PREPARING);
    expect(order.isCancellable()).toBe(false);
  });

  // ── Payment status ────────────────────────────────────

  it('should mark payment failed', () => {
    const order = createOrder();
    order.markPaymentFailed();
    expect(order.paymentStatus).toBe(PaymentStatus.FAILED);
  });

  // ── Getters ───────────────────────────────────────────

  it('should expose all properties', () => {
    const order = createOrder();
    expect(order.pharmacyId).toBe('pharmacy-1');
    expect(order.buyerId).toBe('user-1');
    expect(order.contactPhone).toBe('+998901234567');
    expect(order.deliveryType).toBe('PICKUP');
    expect(order.items).toHaveLength(2);
    expect(order.createdAt).toBeInstanceOf(Date);
  });
});
