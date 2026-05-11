import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TelegramNotifierService, escapeHtml } from '../../infrastructure/telegram-notifier.service';
import { USER_REPOSITORY } from '../../../iam/domain/repositories/user.repository';
import type { UserRepository } from '../../../iam/domain/repositories/user.repository';
import { PHARMACY_REPOSITORY } from '../../../iam/domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../../../iam/domain/repositories/pharmacy.repository';
import type { OrderCreatedEvent } from '../../../ordering/domain/events/order-created.event';
import type { OrderConfirmedEvent } from '../../../ordering/domain/events/order-confirmed.event';
import type { OrderCancelledEvent } from '../../../ordering/domain/events/order-cancelled.event';
import type { OrderStatusChangedEvent } from '../../../ordering/domain/events/order-status-changed.event';
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

    const shortId = event.payload.orderId.slice(-6);
    const phoneEscaped = escapeHtml(event.payload.contactPhone);

    const text = isManualContact
      ? `📞 <b>Новая заявка</b>\n\n` +
        `Заявка #${shortId}\n` +
        `Товаров: ${itemCount}\n` +
        `Сумма: ${amount} сум\n` +
        `Контакт покупателя: <code>${phoneEscaped}</code>\n\n` +
        `Свяжитесь с покупателем для подтверждения и оплаты.`
      : `🆕 <b>Новый заказ!</b>\n\n` +
        `Заказ: #${shortId}\n` +
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
    const shortId = event.payload.orderId.slice(-6);
    const reasonLine = event.payload.reason ? `\nПричина: ${escapeHtml(event.payload.reason)}` : '';

    // Notify pharmacy about cancellation
    const pharmacy = await this.pharmacyRepo.findById(event.payload.pharmacyId);
    if (pharmacy) {
      const owner = await this.userRepo.findById(pharmacy.ownerId);
      if (owner) {
        await this.notifier.sendMessage(
          owner.telegramId.toString(),
          `❌ <b>Заказ отменён</b>\n\nЗаказ #${shortId}${reasonLine}`,
        );
      }
    }

    // Notify buyer too — closes UX gap where buyer never learned about
    // pharmacy-initiated cancellation (manual contact rejections).
    const buyer = await this.userRepo.findById(event.payload.buyerId);
    if (buyer) {
      await this.notifier.sendMessage(
        buyer.telegramId.toString(),
        `❌ <b>Заказ отменён</b>\n\nК сожалению, ваш заказ #${shortId} отменён.${reasonLine}`,
      );
    }
  }

  /**
   * Buyer-facing notifications on status forward-transitions (CONFIRMED via
   * manual contact, PREPARING, READY, DELIVERING, DELIVERED). Closes the
   * customer-experience gap where buyer never learned what's happening with
   * their order. Delivery vs pickup wording differs based on `deliveryType`.
   */
  @OnEvent('order.statusChanged')
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const buyer = await this.userRepo.findById(event.payload.buyerId);
    if (!buyer) return;

    const shortId = event.payload.orderId.slice(-6);
    const isDelivery = event.payload.deliveryType === 'DELIVERY';

    let text: string | null = null;
    switch (event.payload.to) {
      case 'CONFIRMED':
        text = `✅ <b>Заявка принята</b>\n\nАптека подтвердила вашу заявку #${shortId}. Готовим к выдаче.`;
        break;
      case 'PREPARING':
        text = `📦 <b>Заказ в сборке</b>\n\nЗаказ #${shortId} собирается. Скоро будет готов.`;
        break;
      case 'READY':
        text = isDelivery
          ? `🚚 <b>Готов к отправке</b>\n\nЗаказ #${shortId} готов, ожидает курьера.`
          : `✅ <b>Заказ готов</b>\n\nЗаказ #${shortId} можно забрать в аптеке.`;
        break;
      case 'DELIVERING':
        text = `🚚 <b>В доставке</b>\n\nКурьер забрал заказ #${shortId} и едет к вам.`;
        break;
      case 'DELIVERED':
        text = isDelivery
          ? `🎉 <b>Заказ доставлен</b>\n\nЗаказ #${shortId} доставлен. Спасибо за покупку!`
          : `🎉 <b>Заказ выдан</b>\n\nСпасибо за покупку! Заказ #${shortId} выдан.`;
        break;
      // PENDING / PENDING_MANUAL_CONTACT / CANCELLED обрабатываются через
      // OrderCreatedEvent / OrderCancelledEvent — здесь skip чтобы избежать
      // дублирующих DM.
      default:
        return;
    }

    await this.notifier.sendMessage(buyer.telegramId.toString(), text);
    this.logger.log(`Notified buyer about order ${event.payload.orderId} (${event.payload.from} → ${event.payload.to})`);
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
