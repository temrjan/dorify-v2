import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_REPOSITORY } from '../domain/repositories/payment.repository';
import type { PaymentRepository } from '../domain/repositories/payment.repository';
import { PAYMENT_GATEWAY } from '../domain/ports/payment-gateway.port';
import type { PaymentGatewayPort, CallbackData } from '../domain/ports/payment-gateway.port';
import { ORDER_REPOSITORY } from '../../ordering/domain/repositories/order.repository';
import type { OrderRepository } from '../../ordering/domain/repositories/order.repository';
import { PHARMACY_REPOSITORY } from '../../iam/domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../../iam/domain/repositories/pharmacy.repository';
import { Payment } from '../domain/entities/payment.entity';
import { PaymentConfirmedEvent } from '../domain/events/index';
import { config } from '@core/config/env.config';
import type { PaymentResponse } from './dto/payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: PaymentRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: OrderRepository,
    @Inject(PHARMACY_REPOSITORY) private readonly pharmacyRepo: PharmacyRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createInvoice(orderId: string, buyerId: string): Promise<PaymentResponse> {
    // 1. Load order
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Order does not belong to you');

    // 2. Check existing payment
    const existing = await this.paymentRepo.findByOrderId(orderId);
    if (existing?.isPaid()) {
      return this.toResponse(existing);
    }

    // 3. Load pharmacy credentials
    const pharmacy = await this.pharmacyRepo.findById(order.pharmacyId);
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (!pharmacy.hasMulticardCredentials()) {
      throw new ForbiddenException('Pharmacy has no payment credentials configured');
    }

    // 4. Create payment entity
    const payment = Payment.createPending({
      id: this.generateCuid(),
      orderId: order.getId(),
      pharmacyId: order.pharmacyId,
      amount: order.totalAmount,
    });

    // 5. Call Multicard API
    const callbackUrl = config.MULTICARD_CALLBACK_URL
      ?? `https://api.dorify.uz/api/v1/payments/callback`;

    try {
      const result = await this.gateway.createInvoice(
        {
          appId: pharmacy.multicardAppId!,
          storeId: pharmacy.multicardStoreId!,
          secret: pharmacy.multicardSecret!,
        },
        {
          invoiceId: payment.getId(),
          amount: payment.amount.amount,
          description: `Order ${orderId}`,
          callbackUrl,
          items: order.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: item.priceAtTime.amount,
          })),
        },
      );

      payment.setInvoiceData(result.invoiceId, result.checkoutUrl);
      await this.paymentRepo.save(payment);

      this.logger.log(`Invoice created for order ${orderId}: ${result.invoiceId}`);
      return this.toResponse(payment);
    } catch (error) {
      payment.markFailed();
      await this.paymentRepo.save(payment);
      this.logger.error(`Failed to create invoice for order ${orderId}`, error);
      throw error;
    }
  }

  async processCallback(callback: CallbackData): Promise<void> {
    this.logger.log(`Processing callback for invoice ${callback.invoiceId}`);

    // 1. Find payment
    const payment = await this.paymentRepo.findByInvoiceId(callback.invoiceId);
    if (!payment) {
      this.logger.warn(`Payment not found for invoice ${callback.invoiceId}`);
      return; // Return OK to stop Multicard retries
    }

    // 2. Load pharmacy to verify signature
    const pharmacy = await this.pharmacyRepo.findById(payment.pharmacyId);
    if (!pharmacy?.multicardSecret) {
      this.logger.error(`No secret for pharmacy ${payment.pharmacyId}`);
      return;
    }

    // 3. Verify signature
    const valid = this.gateway.verifyCallbackSignature(pharmacy.multicardSecret, callback);
    if (!valid) {
      this.logger.warn(`Invalid callback signature for invoice ${callback.invoiceId}`);
      return;
    }

    // 4. Atomic mark as paid (race-condition-safe)
    const updated = await this.paymentRepo.markPaidAtomically(callback.invoiceId, {
      transactionId: callback.transactionId,
      cardPan: callback.cardPan,
      receiptUrl: callback.receiptUrl,
    });

    if (!updated) {
      this.logger.log(`Payment ${callback.invoiceId} already processed, skipping`);
      return;
    }

    // 5. Emit event → Order.confirm()
    this.eventEmitter.emit('payment.confirmed', new PaymentConfirmedEvent({
      paymentId: updated.getId(),
      orderId: updated.orderId,
      pharmacyId: updated.pharmacyId,
      amount: updated.amount.amount,
    }));

    this.logger.log(`Payment confirmed: ${updated.getId()} for order ${updated.orderId}`);
  }

  async getPaymentStatus(paymentId: string, userId: string): Promise<PaymentResponse> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

    // Ownership check: load order to verify buyer
    const order = await this.orderRepo.findById(payment.orderId);
    if (!order || order.buyerId !== userId) {
      throw new ForbiddenException('Payment does not belong to you');
    }

    return this.toResponse(payment);
  }

  async getPaymentByOrder(orderId: string): Promise<PaymentResponse | undefined> {
    const payment = await this.paymentRepo.findByOrderId(orderId);
    return payment ? this.toResponse(payment) : undefined;
  }

  private toResponse(payment: Payment): PaymentResponse {
    return {
      id: payment.getId(),
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount.amount,
      checkoutUrl: payment.checkoutUrl,
      receiptUrl: payment.receiptUrl,
      paidAt: payment.paidAt?.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
  }
}
