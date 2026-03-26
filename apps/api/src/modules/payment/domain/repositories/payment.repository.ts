import type { Payment } from '../entities/payment.entity';

export interface PaymentRepository {
  findById(id: string): Promise<Payment | undefined>;
  findByInvoiceId(invoiceId: string): Promise<Payment | undefined>;
  findByOrderId(orderId: string): Promise<Payment | undefined>;
  save(payment: Payment): Promise<void>;
  /**
   * Atomic: find by invoiceId WHERE status = 'PENDING' and update to PAID.
   * Returns the payment if updated, undefined if already paid or not found.
   * This is the race-condition-safe callback handler.
   */
  markPaidAtomically(invoiceId: string, data: {
    transactionId: string;
    cardPan?: string;
    receiptUrl?: string;
  }): Promise<Payment | undefined>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
