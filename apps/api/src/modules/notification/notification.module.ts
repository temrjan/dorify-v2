import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { TelegramNotifierService } from './infrastructure/telegram-notifier.service';
import { OrderNotificationHandler } from './application/event-handlers/on-order-events.handler';
import { PharmacyNotificationHandler } from './application/event-handlers/on-pharmacy-events.handler';

@Module({
  imports: [IamModule],
  providers: [
    TelegramNotifierService,
    OrderNotificationHandler,
    PharmacyNotificationHandler,
  ],
})
export class NotificationModule {}
