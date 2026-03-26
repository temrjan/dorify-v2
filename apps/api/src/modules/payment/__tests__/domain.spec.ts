import { Payment, PaymentStatus } from '../domain/entities/payment.entity';
import { Money } from '../../catalog/domain/value-objects/money.vo';
import { MulticardAdapter } from '../infrastructure/multicard/multicard.adapter';
import { createHash } from 'crypto';

// ── Payment Entity ──────────────────────────────────────────

describe('Payment', () => {
  const createPayment = () =>
    Payment.createPending({
      id: 'pay-1',
      orderId: 'order-1',
      pharmacyId: 'pharmacy-1',
      amount: Money.create(55000),
    });

  // ── Creation ──────────────────────────────────────────

  it('should create as PENDING', () => {
    const payment = createPayment();
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.amount.amount).toBe(55000);
    expect(payment.isPending()).toBe(true);
    expect(payment.isPaid()).toBe(false);
  });

  it('should reject zero amount', () => {
    expect(() =>
      Payment.createPending({
        id: 'pay-1',
        orderId: 'order-1',
        pharmacyId: 'pharmacy-1',
        amount: Money.zero(),
      }),
    ).toThrow('greater than zero');
  });

  // ── Invoice data ──────────────────────────────────────

  it('should set invoice data', () => {
    const payment = createPayment();
    payment.setInvoiceData('inv-123', 'https://checkout.example.com/inv-123');
    expect(payment.invoiceId).toBe('inv-123');
    expect(payment.checkoutUrl).toBe('https://checkout.example.com/inv-123');
  });

  it('should not set invoice data on non-PENDING', () => {
    const payment = createPayment();
    payment.markFailed();
    expect(() => payment.setInvoiceData('inv', 'url')).toThrow('Cannot set invoice data');
  });

  // ── Mark paid ─────────────────────────────────────────

  it('should mark as paid', () => {
    const payment = createPayment();
    const result = payment.markPaid({
      transactionId: 'tx-123',
      cardPan: '8600****1234',
      receiptUrl: 'https://receipt.example.com/123',
    });
    expect(result).toBe(true);
    expect(payment.status).toBe(PaymentStatus.PAID);
    expect(payment.isPaid()).toBe(true);
    expect(payment.transactionId).toBe('tx-123');
    expect(payment.cardPan).toBe('8600****1234');
    expect(payment.paidAt).toBeInstanceOf(Date);
  });

  it('should return false on double pay (idempotent)', () => {
    const payment = createPayment();
    payment.markPaid({ transactionId: 'tx-1' });
    const result = payment.markPaid({ transactionId: 'tx-2' });
    expect(result).toBe(false);
    expect(payment.transactionId).toBe('tx-1'); // First one wins
  });

  it('should not pay from FAILED', () => {
    const payment = createPayment();
    payment.markFailed();
    expect(() => payment.markPaid({ transactionId: 'tx' })).toThrow('Cannot mark payment as paid');
  });

  // ── Mark failed ───────────────────────────────────────

  it('should mark as failed from PENDING', () => {
    const payment = createPayment();
    payment.markFailed();
    expect(payment.status).toBe(PaymentStatus.FAILED);
  });

  it('should not fail a paid payment', () => {
    const payment = createPayment();
    payment.markPaid({ transactionId: 'tx' });
    expect(() => payment.markFailed()).toThrow('Cannot mark paid payment as failed');
  });

  // ── Mark expired ──────────────────────────────────────

  it('should expire from PENDING', () => {
    const payment = createPayment();
    payment.markExpired();
    expect(payment.status).toBe(PaymentStatus.EXPIRED);
  });

  it('should not expire non-PENDING', () => {
    const payment = createPayment();
    payment.markPaid({ transactionId: 'tx' });
    expect(() => payment.markExpired()).toThrow('Cannot expire');
  });

  // ── Getters ───────────────────────────────────────────

  it('should expose all properties', () => {
    const payment = createPayment();
    expect(payment.orderId).toBe('order-1');
    expect(payment.pharmacyId).toBe('pharmacy-1');
    expect(payment.provider).toBe('MULTICARD');
    expect(payment.createdAt).toBeInstanceOf(Date);
  });
});

// ── Multicard Adapter (signature verification) ──────────────

describe('MulticardAdapter', () => {
  const adapter = new MulticardAdapter();
  const secret = 'test-secret-key';

  it('should verify valid callback signature', () => {
    const callback = {
      invoiceId: 'inv-123',
      transactionId: 'tx-456',
      status: 'paid',
      amount: 55000,
      sign: '',
    };

    // Calculate expected MD5
    const data = `${callback.invoiceId}${callback.transactionId}${callback.status}${callback.amount}${secret}`;
    callback.sign = createHash('md5').update(data).digest('hex');

    expect(adapter.verifyCallbackSignature(secret, callback)).toBe(true);
  });

  it('should reject invalid signature', () => {
    const callback = {
      invoiceId: 'inv-123',
      transactionId: 'tx-456',
      status: 'paid',
      amount: 55000,
      sign: 'invalid-signature',
    };

    expect(adapter.verifyCallbackSignature(secret, callback)).toBe(false);
  });

  it('should reject tampered amount', () => {
    const callback = {
      invoiceId: 'inv-123',
      transactionId: 'tx-456',
      status: 'paid',
      amount: 55000,
      sign: '',
    };

    const data = `${callback.invoiceId}${callback.transactionId}${callback.status}${callback.amount}${secret}`;
    callback.sign = createHash('md5').update(data).digest('hex');

    // Tamper the amount
    callback.amount = 100;
    expect(adapter.verifyCallbackSignature(secret, callback)).toBe(false);
  });
});
