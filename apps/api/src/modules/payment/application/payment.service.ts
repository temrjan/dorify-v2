import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateId } from '@shared/domain';
import { PAYMENT_REPOSITORY } from '../domain/repositories/payment.repository';
import type { PaymentRepository } from '../domain/repositories/payment.repository';
import { PAYMENT_GATEWAY } from '../domain/ports/payment-gateway.port';
import type {
  PaymentGatewayPort,
  CallbackData,
  PaymentGatewayCredentials,
} from '../domain/ports/payment-gateway.port';
import { ORDER_REPOSITORY } from '../../ordering/domain/repositories/order.repository';
import type { OrderRepository } from '../../ordering/domain/repositories/order.repository';
import { PHARMACY_REPOSITORY } from '../../iam/domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../../iam/domain/repositories/pharmacy.repository';
import { Payment } from '../domain/entities/payment.entity';
import { PaymentConfirmedEvent } from '../domain/events/index';
import { config } from '@core/config/env.config';
import { EncryptionService } from '@core/crypto/encryption.service';
import type { Pharmacy } from '../../iam/domain/entities/pharmacy.entity';
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
    private readonly encryption: EncryptionService,
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
      id: generateId(),
      orderId: order.getId(),
      pharmacyId: order.pharmacyId,
      amount: order.totalAmount,
    });

    // 5. Call Multicard API
    const callbackUrl = config.MULTICARD_CALLBACK_URL
      ?? `https://api.dorify.uz/api/v1/payments/callback`;
    const webUrl = config.WEB_URL.replace(/\/+$/, '');
    const returnUrl = `${webUrl}/payment/result?orderId=${encodeURIComponent(orderId)}`;

    try {
      const credentials = this.gatewayCredentialsFor(pharmacy);
      const result = await this.gateway.createInvoice(
        credentials,
        {
          invoiceId: payment.getId(),
          amount: payment.amount.amount,
          description: `Order ${orderId}`,
          callbackUrl,
          returnUrl,
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

    // 3. Verify signature (decrypt secret first)
    const plaintextSecret = this.encryption.decrypt(pharmacy.multicardSecret);
    const valid = this.gateway.verifyCallbackSignature(plaintextSecret, callback);
    if (!valid) {
      this.logger.warn(`Invalid callback signature for invoice ${callback.invoiceId}`);
      return;
    }

    // 3.5 Amount cross-check (defense-in-depth, closes S-HIGH-10).
    // Signature MD5(storeId+invoiceId+amount+secret) уже включает amount,
    // но defense-in-depth: явная проверка amount match блокирует scenarios
    // где gateway-side bug либо secret compromise могли бы привести к
    // accepted payment с неправильной суммой. Multicard оперирует в tiyin,
    // наш Payment.amount хранится в sum (UZS). 1 sum = 100 tiyin.
    const TIYIN_PER_SUM = 100;
    const expectedTiyin = payment.amount.amount * TIYIN_PER_SUM;
    if (callback.amount !== expectedTiyin) {
      this.logger.error(
        `Amount mismatch for invoice ${callback.invoiceId}: callback=${callback.amount} tiyin, payment=${expectedTiyin} tiyin (${payment.amount.amount} sum)`,
      );
      return;
    }

    // 4. Atomic mark as paid (race-condition-safe)
    const updated = await this.paymentRepo.markPaidAtomically(callback.invoiceId, {
      transactionId: callback.uuid,
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

  async getPaymentByOrder(orderId: string, userId: string): Promise<PaymentResponse | undefined> {
    // Ownership check (closes S-CRIT-8 IDOR). Прежний `getPaymentByOrder(orderId)`
    // без проверки позволял любому авторизованному user'у читать payment
    // status, checkoutUrl, receiptUrl любого заказа. PaymentResponse содержит
    // sensitive поля для PDPL (transactionId / cardPan stored — currently не
    // returned, но receiptUrl даёт callback access).
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.buyerId !== userId) {
      throw new ForbiddenException('Payment does not belong to you');
    }

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

  private gatewayCredentialsFor(pharmacy: Pharmacy): PaymentGatewayCredentials {
    if (!pharmacy.multicardAppId || !pharmacy.multicardStoreId || !pharmacy.multicardSecret) {
      throw new ForbiddenException('Pharmacy has no payment credentials configured');
    }
    return {
      appId: pharmacy.multicardAppId,
      storeId: pharmacy.multicardStoreId,
      secret: this.encryption.decrypt(pharmacy.multicardSecret),
    };
  }

  /**
   * Reconciles payments stuck в PENDING longer than `thresholdMinutes` against
   * the gateway. Used by ReconcilePaymentsCron to recover from dropped
   * callbacks (network issues, gateway outage). Audit S-MED-3 / Phase 4
   * closure: callback может не дойти, но gateway знает реальный статус.
   *
   * Flow per stale payment:
   * 1. Skip если pharmacy creds gone (pharmacy deactivated mid-flight)
   * 2. Query gateway.getInvoiceStatus
   * 3. If PAID — markPaidAtomically (CAS — survives concurrent callback
   *    arriving в parallel) → emit PaymentConfirmedEvent
   * 4. If FAILED либо REFUNDED — log only, leave PENDING для manual
   *    review (rare, signals gateway-side issue)
   *
   * Returns count of reconciled payments — useful для logging/metrics.
   */
  async reconcileStalePending(thresholdMinutes = 10): Promise<number> {
    const stale = await this.paymentRepo.findStalePending(thresholdMinutes);
    if (stale.length === 0) return 0;

    this.logger.log(`Reconciling ${stale.length} stale PENDING payment(s) (older than ${thresholdMinutes}m)`);
    let reconciledCount = 0;

    for (const payment of stale) {
      try {
        if (!payment.invoiceId) continue;

        const pharmacy = await this.pharmacyRepo.findById(payment.pharmacyId);
        if (!pharmacy?.hasMulticardCredentials()) {
          this.logger.warn(
            `Payment ${payment.getId()}: pharmacy ${payment.pharmacyId} no longer has Multicard creds — skipping reconcile`,
          );
          continue;
        }

        const creds = this.gatewayCredentialsFor(pharmacy);
        const gatewayStatus = await this.gateway.getInvoiceStatus(creds, payment.invoiceId);

        if (gatewayStatus.status === 'PAID') {
          // Reconciled: gateway considers paid, mark locally + emit event.
          // Note: cron-driven reconcile loses cardPan / receiptUrl detail
          // (those come from callback). Acceptable trade-off; receipt
          // can be requested manually if needed.
          const updated = await this.paymentRepo.markPaidAtomically(payment.invoiceId, {
            transactionId: `reconciled:${payment.invoiceId}`,
          });
          if (updated) {
            this.eventEmitter.emit(
              'payment.confirmed',
              new PaymentConfirmedEvent({
                paymentId: updated.getId(),
                orderId: updated.orderId,
                pharmacyId: updated.pharmacyId,
                amount: updated.amount.amount,
              }),
            );
            reconciledCount++;
            this.logger.log(`Payment ${updated.getId()} reconciled to PAID (callback was lost)`);
          }
        } else if (gatewayStatus.status === 'FAILED' || gatewayStatus.status === 'REFUNDED') {
          // Don't auto-mark — signals gateway issue либо partial flow.
          // Leaving PENDING ensures human review.
          this.logger.warn(
            `Payment ${payment.getId()}: gateway reports ${gatewayStatus.status} — left PENDING for manual review`,
          );
        }
      } catch (error) {
        // One payment failing should not block others.
        this.logger.error(
          `Reconcile failed for payment ${payment.getId()}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (reconciledCount > 0) {
      this.logger.log(`Reconciled ${reconciledCount}/${stale.length} payments`);
    }
    return reconciledCount;
  }
}
