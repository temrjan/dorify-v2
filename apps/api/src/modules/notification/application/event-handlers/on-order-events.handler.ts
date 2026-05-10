import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TelegramNotifierService } from '../../infrastructure/telegram-notifier.service';
import { USER_REPOSITORY } from '../../../iam/domain/repositories/user.repository';
import type { UserRepository } from '../../../iam/domain/repositories/user.repository';
import { PHARMACY_REPOSITORY } from '../../../iam/domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../../../iam/domain/repositories/pharmacy.repository';
import type { OrderCreatedEvent } from '../../../ordering/domain/events/order-created.event';
import type { OrderConfirmedEvent } from '../../../ordering/domain/events/order-confirmed.event';
import type { OrderCancelledEvent } from '../../../ordering/domain/events/order-cancelled.event';
import type { PaymentConfirmedEvent } from '../../../payment/domain/events/index';

@Injectable()
export class OrderNotificationHandler {
  private readonly logger = new Logger(OrderNotificationHandler.name);

  constructor(
    private readonly notifier: TelegramNotifierService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PHARMACY_REPOSITORY) private readonly pharmacyRepo: PharmacyRepository,
  ) {}

  @OnEvent('order.created')
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Notify pharmacy owner about new order. Message differs based on
    // status: manual contact = заявка + buyer contact (продавец звонит);
    // PENDING = standard order awaiting payment confirmation.
    const pharmacy = await this.pharmacyRepo.findById(event.payload.pharmacyId);
    if (!pharmacy) return;

    const owner = await this.userRepo.findById(pharmacy.ownerId);
    if (!owner) return;

    const itemCount = event.payload.items.reduce((sum, i) => sum + i.quantity, 0);
    const amount = new Intl.NumberFormat('uz-UZ').format(event.payload.totalAmount);
    const isManualContact = event.payload.status === 'PENDING_MANUAL_CONTACT';

    const text = isManualContact
      ? `📞 <b>Новая заявка</b>\n\n` +
        `Заявка #${event.payload.orderId.slice(-6)}\n` +
        `Товаров: ${itemCount}\n` +
        `Сумма: ${amount} сум\n` +
        `Контакт покупателя: <code>${event.payload.contactPhone}</code>\n\n` +
        `Свяжитесь с покупателем для подтверждения и оплаты.`
      : `🆕 <b>Новый заказ!</b>\n\n` +
        `Заказ: #${event.payload.orderId.slice(-6)}\n` +
        `Товаров: ${itemCount}\n` +
        `Сумма: ${amount} сум`;

    await this.notifier.sendMessage(owner.telegramId.toString(), text);
    this.logger.log(`Notified pharmacy owner about order ${event.payload.orderId} (status=${event.payload.status})`);
  }

  @OnEvent('order.confirmed')
  async onOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    // Notify buyer that order is confirmed
    const buyer = await this.userRepo.findById(event.payload.buyerId);
    if (!buyer) return;

    await this.notifier.sendMessage(
      buyer.telegramId.toString(),
      `✅ <b>Заказ подтверждён!</b>\n\n` +
      `Заказ #${event.payload.orderId.slice(-6)} оплачен и принят в обработку.`,
    );
  }

  @OnEvent('order.cancelled')
  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    // Notify pharmacy about cancellation
    const pharmacy = await this.pharmacyRepo.findById(event.payload.pharmacyId);
    if (!pharmacy) return;

    const owner = await this.userRepo.findById(pharmacy.ownerId);
    if (!owner) return;

    await this.notifier.sendMessage(
      owner.telegramId.toString(),
      `❌ <b>Заказ отменён</b>\n\n` +
      `Заказ #${event.payload.orderId.slice(-6)}` +
      (event.payload.reason ? `\nПричина: ${event.payload.reason}` : ''),
    );
  }

  @OnEvent('payment.confirmed')
  async onPaymentConfirmed(event: PaymentConfirmedEvent): Promise<void> {
    // Notify pharmacy about successful payment
    const pharmacy = await this.pharmacyRepo.findById(event.payload.pharmacyId);
    if (!pharmacy) return;

    const owner = await this.userRepo.findById(pharmacy.ownerId);
    if (!owner) return;

    const amount = new Intl.NumberFormat('uz-UZ').format(event.payload.amount);

    await this.notifier.sendMessage(
      owner.telegramId.toString(),
      `💰 <b>Оплата получена!</b>\n\n` +
      `Заказ #${event.payload.orderId.slice(-6)}\n` +
      `Сумма: ${amount} сум`,
    );
  }
}
