import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './core/core.module';
import { IamModule } from './modules/iam/iam.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrderingModule } from './modules/ordering/ordering.module';
import { PaymentModule } from './modules/payment/payment.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    CoreModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    IamModule,
    CatalogModule,
    OrderingModule,
    PaymentModule,
    // Phase 7: SearchModule,
    // Phase 6: NotificationModule,
  ],
})
export class AppModule {}
