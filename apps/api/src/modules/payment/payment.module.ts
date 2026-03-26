import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { OrderingModule } from '../ordering/ordering.module';
import { PaymentService } from './application/payment.service';
import { OnPaymentConfirmedHandler } from './application/event-handlers/on-payment-confirmed.handler';
import { PaymentController } from './infrastructure/controllers/payment.controller';
import { PrismaPaymentRepository } from './infrastructure/persistence/prisma-payment.repository';
import { MulticardAdapter } from './infrastructure/multicard/multicard.adapter';
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository';
import { PAYMENT_GATEWAY } from './domain/ports/payment-gateway.port';

@Module({
  imports: [IamModule, OrderingModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    OnPaymentConfirmedHandler,
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: PAYMENT_GATEWAY, useClass: MulticardAdapter },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
