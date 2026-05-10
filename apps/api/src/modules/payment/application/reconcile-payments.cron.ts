import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from './payment.service';

/**
 * Periodic reconciliation of payments stuck в PENDING (Phase 4 closure).
 *
 * Why: Multicard sends webhook на /payments/callback after payment, но
 * webhook может потеряться (network, IP whitelist false-positive,
 * downtime). Periodic reconcile queries gateway directly для stale
 * PENDING payments — single source of truth для actual status.
 *
 * Cadence: every 5 minutes. Threshold: 10 min minimum age (избегает
 * race с in-flight legitimate flows). Combined → up to ~15 min total
 * delay before reconcile catches a lost callback. Acceptable for
 * payment marketplace; tune if business requires faster.
 */
@Injectable()
export class ReconcilePaymentsCron {
  private readonly logger = new Logger(ReconcilePaymentsCron.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'reconcile-payments' })
  async run(): Promise<void> {
    try {
      const reconciled = await this.paymentService.reconcileStalePending(10);
      if (reconciled > 0) {
        this.logger.log(`Cron tick: reconciled ${reconciled} payment(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Reconcile cron failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
