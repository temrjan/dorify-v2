import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentService } from '../application/payment.service';
import { Payment, PaymentStatus } from '../domain/entities/payment.entity';
import { Order, OrderStatus, PaymentStatus as OrderPaymentStatus } from '../../ordering/domain/entities/order.entity';
import { OrderItem } from '../../ordering/domain/entities/order-item.entity';
import { Money } from '../../catalog/domain/value-objects/money.vo';
import { Pharmacy } from '../../iam/domain/entities/pharmacy.entity';
import { PhoneNumber } from '../../iam/domain/value-objects/phone-number.vo';
import { EncryptionService } from '@core/crypto/encryption.service';
import type { PaymentRepository } from '../domain/repositories/payment.repository';
import type { PaymentGatewayPort, CallbackData } from '../domain/ports/payment-gateway.port';
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

function buildPharmacyWithMulticard(): Pharmacy {
  return Pharmacy.reconstitute({
    id: 'pharmacy-X',
    ownerId: 'owner-1',
    name: 'Test',
    slug: 'test',
    address: 'Tashkent',
    phone: PhoneNumber.create('+998901234567'),
    isActive: true,
    isVerified: true,
    deliveryEnabled: false,
    multicardAppId: 'app',
    multicardStoreId: 'store',
    multicardSecret: 'encrypted-secret',
    createdAt: new Date(),
  });
}

function buildCallback(amountTiyin: number): CallbackData {
  return {
    storeId: 'store',
    invoiceId: 'inv-1',
    amount: amountTiyin,
    uuid: 'uuid-1',
    sign: 'sig',
  };
}

function createService(overrides: {
  orderFindById?: jest.Mock;
  paymentFindByOrderId?: jest.Mock;
  paymentFindByInvoiceId?: jest.Mock;
  markPaidAtomically?: jest.Mock;
  pharmacyFindById?: jest.Mock;
  verifyCallbackSignature?: jest.Mock;
} = {}) {
  const paymentRepo: PaymentRepository = {
    findById: jest.fn(),
    findByInvoiceId: overrides.paymentFindByInvoiceId ?? jest.fn(),
    findByOrderId: overrides.paymentFindByOrderId ?? jest.fn(),
    save: jest.fn(),
    markPaidAtomically: overrides.markPaidAtomically ?? jest.fn(),
    findStalePending: jest.fn(),
  };
  const orderRepo: OrderRepository = {
    findById: overrides.orderFindById ?? jest.fn(),
    findByBuyerId: jest.fn(),
    findByPharmacyId: jest.fn(),
    save: jest.fn(),
    placeAtomically: jest.fn(),
  };
  const gateway = {
    createInvoice: jest.fn(),
    getInvoiceStatus: jest.fn(),
    verifyCallbackSignature: overrides.verifyCallbackSignature ?? jest.fn().mockReturnValue(true),
  } as unknown as PaymentGatewayPort;
  const pharmacyRepo = {
    findById: overrides.pharmacyFindById ?? jest.fn(),
    findByOwnerId: jest.fn(),
    findBySlug: jest.fn(),
    save: jest.fn(),
  } as unknown as PharmacyRepository;
  const eventEmitter = new EventEmitter2();
  const encryption = {
    encrypt: jest.fn(),
    decrypt: jest.fn().mockReturnValue('plaintext-secret'),
  } as unknown as EncryptionService;
  return {
    service: new PaymentService(paymentRepo, gateway, orderRepo, pharmacyRepo, eventEmitter, encryption),
    paymentRepo,
    eventEmitter,
  };
}

// ── getPaymentByOrder ownership check (S-CRIT-8) ────────────

describe('PaymentService.getPaymentByOrder ownership check', () => {
  it('throws NotFoundException when order does not exist', async () => {
    const { service } = createService({
      orderFindById: jest.fn().mockResolvedValue(undefined),
    });
    await expect(service.getPaymentByOrder('missing-order', 'buyer-A')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when requester is not the order buyer (IDOR vector)', async () => {
    const { service } = createService({
      orderFindById: jest.fn().mockResolvedValue(buildOrder('buyer-A')),
    });
    await expect(service.getPaymentByOrder('order-1', 'stranger')).rejects.toThrow(ForbiddenException);
  });

  it('returns payment when requester is the order buyer', async () => {
    const { service } = createService({
      orderFindById: jest.fn().mockResolvedValue(buildOrder('buyer-A')),
      paymentFindByOrderId: jest.fn().mockResolvedValue(buildPayment()),
    });
    const result = await service.getPaymentByOrder('order-1', 'buyer-A');
    expect(result?.id).toBe('payment-1');
    expect(result?.orderId).toBe('order-1');
  });

  it('returns undefined when buyer matches but payment row not yet created', async () => {
    // Edge case: order placed, polling started before invoice creation completed.
    const { service } = createService({
      orderFindById: jest.fn().mockResolvedValue(buildOrder('buyer-A')),
      paymentFindByOrderId: jest.fn().mockResolvedValue(undefined),
    });
    const result = await service.getPaymentByOrder('order-1', 'buyer-A');
    expect(result).toBeUndefined();
  });
});

// ── processCallback amount cross-check (S-HIGH-10) ──────────

describe('PaymentService.processCallback amount cross-check', () => {
  it('accepts callback when amount matches (sum-to-tiyin conversion)', async () => {
    // Payment.amount = 10000 sum → expected callback.amount = 1_000_000 tiyin
    const payment = buildPayment(); // amount 10000 UZS
    const updatedPayment = Payment.reconstitute({
      id: payment.getId(),
      orderId: payment.orderId,
      pharmacyId: payment.pharmacyId,
      provider: 'MULTICARD',
      status: PaymentStatus.PAID,
      amount: Money.create(10000),
      createdAt: new Date(),
    });
    const markPaidMock = jest.fn().mockResolvedValue(updatedPayment);

    const { service } = createService({
      paymentFindByInvoiceId: jest.fn().mockResolvedValue(payment),
      pharmacyFindById: jest.fn().mockResolvedValue(buildPharmacyWithMulticard()),
      markPaidAtomically: markPaidMock,
    });

    await service.processCallback(buildCallback(1_000_000));
    expect(markPaidMock).toHaveBeenCalledTimes(1);
  });

  it('rejects callback when amount mismatches expected (S-HIGH-10 defense)', async () => {
    // Payment.amount = 10000 sum → expected 1_000_000 tiyin, callback sends 500_000.
    // Sig verification mocked true — без amount check этот callback прошёл бы.
    const markPaidMock = jest.fn();

    const { service } = createService({
      paymentFindByInvoiceId: jest.fn().mockResolvedValue(buildPayment()),
      pharmacyFindById: jest.fn().mockResolvedValue(buildPharmacyWithMulticard()),
      markPaidAtomically: markPaidMock,
    });

    await service.processCallback(buildCallback(500_000));
    expect(markPaidMock).not.toHaveBeenCalled();
  });

  it('rejects callback with zero amount', async () => {
    const markPaidMock = jest.fn();

    const { service } = createService({
      paymentFindByInvoiceId: jest.fn().mockResolvedValue(buildPayment()),
      pharmacyFindById: jest.fn().mockResolvedValue(buildPharmacyWithMulticard()),
      markPaidAtomically: markPaidMock,
    });

    await service.processCallback(buildCallback(0));
    expect(markPaidMock).not.toHaveBeenCalled();
  });

  it('rejects callback with inflated amount (overcharge attempt)', async () => {
    const markPaidMock = jest.fn();

    const { service } = createService({
      paymentFindByInvoiceId: jest.fn().mockResolvedValue(buildPayment()),
      pharmacyFindById: jest.fn().mockResolvedValue(buildPharmacyWithMulticard()),
      markPaidAtomically: markPaidMock,
    });

    // Payment 10000 sum = 1_000_000 tiyin; callback claims 999_999_999 tiyin.
    await service.processCallback(buildCallback(999_999_999));
    expect(markPaidMock).not.toHaveBeenCalled();
  });
});
