import type { Payment as PrismaPayment } from '@prisma/client';
import { Payment, PaymentStatus } from '../../../domain/entities/payment.entity';
import { Money } from '../../../../catalog/domain/value-objects/money.vo';

export class PaymentMapper {
  static toDomain(record: PrismaPayment): Payment {
    return Payment.reconstitute({
      id: record.id,
      orderId: record.orderId,
      pharmacyId: record.pharmacyId,
      provider: record.provider,
      status: record.status as PaymentStatus,
      amount: Money.create(Number(record.amount)),
      invoiceId: record.invoiceId ?? undefined,
      checkoutUrl: record.checkoutUrl ?? undefined,
      transactionId: record.transactionId ?? undefined,
      cardPan: record.cardPan ?? undefined,
      receiptUrl: record.receiptUrl ?? undefined,
      paidAt: record.paidAt ?? undefined,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(payment: Payment) {
    return {
      id: payment.getId(),
      orderId: payment.orderId,
      pharmacyId: payment.pharmacyId,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount.amount,
      invoiceId: payment.invoiceId ?? null,
      checkoutUrl: payment.checkoutUrl ?? null,
      transactionId: payment.transactionId ?? null,
      cardPan: payment.cardPan ?? null,
      receiptUrl: payment.receiptUrl ?? null,
      paidAt: payment.paidAt ?? null,
    };
  }
}
