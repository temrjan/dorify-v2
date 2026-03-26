import { Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import type { PaymentRepository } from '../../domain/repositories/payment.repository';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentMapper } from './mappers/payment.mapper';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Payment | undefined> {
    const record = await this.prisma.payment.findUnique({ where: { id } });
    return record ? PaymentMapper.toDomain(record) : undefined;
  }

  async findByInvoiceId(invoiceId: string): Promise<Payment | undefined> {
    const record = await this.prisma.payment.findUnique({ where: { invoiceId } });
    return record ? PaymentMapper.toDomain(record) : undefined;
  }

  async findByOrderId(orderId: string): Promise<Payment | undefined> {
    const record = await this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? PaymentMapper.toDomain(record) : undefined;
  }

  async save(payment: Payment): Promise<void> {
    const data = PaymentMapper.toPersistence(payment);
    await this.prisma.payment.upsert({
      where: { id: data.id },
      create: { ...data, provider: data.provider as PaymentProvider },
      update: {
        status: data.status,
        invoiceId: data.invoiceId,
        checkoutUrl: data.checkoutUrl,
        transactionId: data.transactionId,
        cardPan: data.cardPan,
        receiptUrl: data.receiptUrl,
        paidAt: data.paidAt,
      },
    });
  }

  /**
   * Race-condition-safe: atomically find PENDING payment and mark as PAID.
   * Uses WHERE status = 'PENDING' inside transaction to prevent double-processing.
   */
  async markPaidAtomically(
    invoiceId: string,
    data: { transactionId: string; cardPan?: string; receiptUrl?: string },
  ): Promise<Payment | undefined> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Atomic check-and-update: only updates if status is still PENDING
      const updated = await tx.payment.updateMany({
        where: { invoiceId, status: 'PENDING' },
        data: {
          status: 'PAID',
          transactionId: data.transactionId,
          cardPan: data.cardPan ?? null,
          receiptUrl: data.receiptUrl ?? null,
          paidAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return undefined; // Already paid or not found
      }

      // Fetch the updated record
      return tx.payment.findUnique({ where: { invoiceId } });
    });

    return result ? PaymentMapper.toDomain(result) : undefined;
  }
}
