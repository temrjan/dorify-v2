import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentService } from '../application/payment.service';
import { Payment, PaymentStatus } from '../domain/entities/payment.entity';
import { Order, OrderStatus, PaymentStatus as OrderPaymentStatus } from '../../ordering/domain/entities/order.entity';
import { OrderItem } from '../../ordering/domain/entities/order-item.entity';
import { Money } from '../../catalog/domain/value-objects/money.vo';
import { EncryptionService } from '@core/crypto/encryption.service';
import type { PaymentRepository } from '../domain/repositories/payment.repository';
import type { PaymentGatewayPort } from '../domain/ports/payment-gateway.port';
import type { OrderRepository } from '../../ordering/domain/repositories/order.repository';
import type { PharmacyRepository } from '../../iam/domain/repositories/pharmacy.repository';

// ── Helpers ─────────────────────────────────────────────────

function buildOrder(buyerId = 'buyer-A'): Order {
  const item = OrderItem.create({
    id: 'item-1',
    productId: 'product-1',
    productName: 'X',
    quantity: 1,
    priceAtTime: Money.create(10000),
  });
  return Order.reconstitute({
    id: 'order-1',
    pharmacyId: 'pharmacy-X',
    buyerId,
    items: [item],
    status: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.PENDING,
    totalAmount: Money.create(10000),
    deliveryType: 'PICKUP',
    contactPhone: '+998901234567',
    createdAt: new Date(),
  });
}

function buildPayment(): Payment {
  return Payment.reconstitute({
    id: 'payment-1',
    orderId: 'order-1',
    pharmacyId: 'pharmacy-X',
    provider: 'MULTICARD',
    status: PaymentStatus.PENDING,
    amount: Money.create(10000),
    createdAt: new Date(),
  });
}

function createService(overrides: {
  orderFindById?: jest.Mock;
  paymentFindByOrderId?: jest.Mock;
} = {}) {
  const paymentRepo: PaymentRepository = {
    findById: jest.fn(),
    findByInvoiceId: jest.fn(),
    findByOrderId: overrides.paymentFindByOrderId ?? jest.fn(),
    save: jest.fn(),
    markPaidAtomically: jest.fn(),
    findStalePending: jest.fn(),
  };
  const orderRepo: OrderRepository = {
    findById: overrides.orderFindById ?? jest.fn(),
    findByBuyerId: jest.fn(),
    findByPharmacyId: jest.fn(),
    save: jest.fn(),
    placeAtomically: jest.fn(),
  };
  const gateway = {} as PaymentGatewayPort;
  const pharmacyRepo = {} as PharmacyRepository;
  const eventEmitter = new EventEmitter2();
  const encryption = {} as EncryptionService;
  return new PaymentService(paymentRepo, gateway, orderRepo, pharmacyRepo, eventEmitter, encryption);
}

// ── getPaymentByOrder ownership check (S-CRIT-8) ────────────

describe('PaymentService.getPaymentByOrder ownership check', () => {
  it('throws NotFoundException when order does not exist', async () => {
    const service = createService({
      orderFindById: jest.fn().mockResolvedValue(undefined),
    });
    await expect(service.getPaymentByOrder('missing-order', 'buyer-A')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when requester is not the order buyer (IDOR vector)', async () => {
    const service = createService({
      orderFindById: jest.fn().mockResolvedValue(buildOrder('buyer-A')),
    });
    await expect(service.getPaymentByOrder('order-1', 'stranger')).rejects.toThrow(ForbiddenException);
  });

  it('returns payment when requester is the order buyer', async () => {
    const service = createService({
      orderFindById: jest.fn().mockResolvedValue(buildOrder('buyer-A')),
      paymentFindByOrderId: jest.fn().mockResolvedValue(buildPayment()),
    });
    const result = await service.getPaymentByOrder('order-1', 'buyer-A');
    expect(result?.id).toBe('payment-1');
    expect(result?.orderId).toBe('order-1');
  });

  it('returns undefined when buyer matches but payment row not yet created', async () => {
    // Edge case: order placed, polling started before invoice creation completed.
    const service = createService({
      orderFindById: jest.fn().mockResolvedValue(buildOrder('buyer-A')),
      paymentFindByOrderId: jest.fn().mockResolvedValue(undefined),
    });
    const result = await service.getPaymentByOrder('order-1', 'buyer-A');
    expect(result).toBeUndefined();
  });
});
