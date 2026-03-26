import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './core/core.module';
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
    // Phase 1: IamModule,
    // Phase 2: CatalogModule,
    // Phase 3: OrderingModule,
    // Phase 4: PaymentModule,
    // Phase 7: SearchModule,
    // Phase 6: NotificationModule,
  ],
})
export class AppModule {}
