import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { TelegramNotifierService } from './infrastructure/telegram-notifier.service';
import { OrderNotificationHandler } from './application/event-handlers/on-order-events.handler';

@Module({
  imports: [IamModule],
  providers: [
    TelegramNotifierService,
    OrderNotificationHandler,
  ],
})
export class NotificationModule {}
