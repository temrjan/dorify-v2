import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderingService } from '../application/ordering.service';
import { Order, OrderStatus, PaymentStatus } from '../domain/entities/order.entity';
import { OrderItem } from '../domain/entities/order-item.entity';
import { Money } from '../../catalog/domain/value-objects/money.vo';
import type { OrderRepository } from '../domain/repositories/order.repository';
import type { ProductRepository } from '../../catalog/domain/repositories/product.repository';
import type { PharmacyRepository } from '../../iam/domain/repositories/pharmacy.repository';

// ── Helpers ─────────────────────────────────────────────────

function buildOrder(overrides: { buyerId?: string; pharmacyId?: string } = {}): Order {
  const item = OrderItem.create({
    id: 'item-1',
    productId: 'product-1',
    productName: 'Парацетамол',
    quantity: 1,
    priceAtTime: Money.create(10000),
  });
  return Order.reconstitute({
    id: 'order-1',
    pharmacyId: overrides.pharmacyId ?? 'pharmacy-X',
    buyerId: overrides.buyerId ?? 'buyer-A',
    items: [item],
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    totalAmount: Money.create(10000),
    deliveryType: 'PICKUP',
    contactPhone: '+998901234567',
    createdAt: new Date(),
  });
}

function createService(orderRepoOverride: Partial<OrderRepository> = {}) {
  const orderRepo: OrderRepository = {
    findById: jest.fn(),
    findByBuyerId: jest.fn(),
    findByPharmacyId: jest.fn(),
    save: jest.fn(),
    placeAtomically: jest.fn(),
    ...orderRepoOverride,
  };
  const productRepo = {} as ProductRepository;
  const pharmacyRepo = {} as PharmacyRepository;
  const eventEmitter = new EventEmitter2();
  const service = new OrderingService(orderRepo, productRepo, pharmacyRepo, eventEmitter);
  return { service, orderRepo };
}

// ── getOrder ownership check (S-CRIT-7) ─────────────────────

describe('OrderingService.getOrder ownership check', () => {
  it('throws NotFoundException when order does not exist', async () => {
    const { service } = createService({ findById: jest.fn().mockResolvedValue(undefined) });
    await expect(service.getOrder('missing-id', 'buyer-A')).rejects.toThrow(NotFoundException);
  });

  it('returns order when requester is the buyer', async () => {
    const order = buildOrder({ buyerId: 'buyer-A' });
    const { service } = createService({ findById: jest.fn().mockResolvedValue(order) });
    const result = await service.getOrder('order-1', 'buyer-A');
    expect(result.id).toBe('order-1');
    expect(result.buyerId).toBe('buyer-A');
  });

  it('returns order when requester is the pharmacy owner', async () => {
    const order = buildOrder({ pharmacyId: 'pharmacy-X' });
    const { service } = createService({ findById: jest.fn().mockResolvedValue(order) });
    const result = await service.getOrder('order-1', 'someone-else', 'pharmacy-X');
    expect(result.pharmacyId).toBe('pharmacy-X');
  });

  it('throws ForbiddenException when requester is neither buyer nor pharmacy owner (IDOR vector)', async () => {
    const order = buildOrder({ buyerId: 'buyer-A', pharmacyId: 'pharmacy-X' });
    const { service } = createService({ findById: jest.fn().mockResolvedValue(order) });
    await expect(service.getOrder('order-1', 'stranger', 'pharmacy-Y')).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when buyer requester provides pharmacyId of unrelated pharmacy', async () => {
    const order = buildOrder({ buyerId: 'buyer-A', pharmacyId: 'pharmacy-X' });
    const { service } = createService({ findById: jest.fn().mockResolvedValue(order) });
    await expect(service.getOrder('order-1', 'stranger', 'pharmacy-Z')).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when pharmacyId is undefined and buyerId does not match (buyer without pharmacy)', async () => {
    const order = buildOrder({ buyerId: 'buyer-A' });
    const { service } = createService({ findById: jest.fn().mockResolvedValue(order) });
    await expect(service.getOrder('order-1', 'stranger', undefined)).rejects.toThrow(ForbiddenException);
  });
});
