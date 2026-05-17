import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { config } from '@core/config/env.config';
import { TelegramNotifierService, escapeHtml } from '../../infrastructure/telegram-notifier.service';
import { USER_REPOSITORY } from '../../../iam/domain/repositories/user.repository';
import type { UserRepository } from '../../../iam/domain/repositories/user.repository';
import { PHARMACY_REPOSITORY } from '../../../iam/domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../../../iam/domain/repositories/pharmacy.repository';
import type {
  ProductCreatedEvent,
  ProductHiddenByAdminEvent,
} from '../../../catalog/domain/events';

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

@Injectable()
export class ProductNotificationHandler {
  private readonly logger = new Logger(ProductNotificationHandler.name);

  constructor(
    private readonly notifier: TelegramNotifierService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PHARMACY_REPOSITORY) private readonly pharmacyRepo: PharmacyRepository,
  ) {}

  /**
   * New product auto-published → DM admins так чтобы они могли скрыть товар
   * при нарушении правил (post-moderation MVP). Бот handles `product:hide:<id>`
   * callback и шлёт reason запрос с дальнейшим POST /admin/products/:id/hide.
   */
  @OnEvent('product.created')
  async onProductCreated(event: ProductCreatedEvent): Promise<void> {
    const { productId, pharmacyId, name, price, category } = event.payload;
    const admins = config.ADMIN_CHAT_IDS;

    if (admins.length === 0) {
      this.logger.warn(
        `product.created (${productId}): no ADMIN_CHAT_IDS configured — post-moderation alerts disabled`,
      );
      return;
    }

    const pharmacy = await this.pharmacyRepo.findById(pharmacyId);
    const pharmacyLine = pharmacy ? escapeHtml(pharmacy.name) : escapeHtml(pharmacyId);
    const categoryLine = category ? `\nКатегория: ${escapeHtml(category)}` : '';

    const text =
      `🆕 <b>Новый товар опубликован</b>\n\n` +
      `<b>${escapeHtml(name)}</b>\n` +
      `Цена: <b>${formatPrice(price)} сум</b>${categoryLine}\n` +
      `Аптека: ${pharmacyLine}\n\n` +
      `Проверьте — товар уже виден покупателям. Скройте при нарушении правил.`;

    const keyboard = [
      [{ text: '🗑 Скрыть', callback_data: `product:hide:${productId}` }],
    ];

    for (const chatId of admins) {
      await this.notifier.sendMessage(chatId, text, { inlineKeyboard: keyboard });
    }
    this.logger.log(`Notified ${admins.length} admin(s) about product ${productId}`);
  }

  /**
   * Product hidden by admin → DM pharmacy owner с причиной чтобы могли
   * исправить и опубликовать заново.
   */
  @OnEvent('product.hiddenByAdmin')
  async onProductHiddenByAdmin(event: ProductHiddenByAdminEvent): Promise<void> {
    const { pharmacyId, name, reason } = event.payload;

    const pharmacy = await this.pharmacyRepo.findById(pharmacyId);
    if (!pharmacy) {
      this.logger.warn(`product.hiddenByAdmin: pharmacy ${pharmacyId} not found`);
      return;
    }

    const owner = await this.userRepo.findById(pharmacy.ownerId);
    if (!owner) {
      this.logger.warn(`product.hiddenByAdmin: owner ${pharmacy.ownerId} not found`);
      return;
    }

    await this.notifier.sendMessage(
      owner.telegramId.toString(),
      `🚫 <b>Товар скрыт модератором</b>\n\n` +
        `<b>${escapeHtml(name)}</b>\n\n` +
        `Причина: ${escapeHtml(reason)}\n\n` +
        `Исправьте недочёты и создайте товар заново. ` +
        `Подробности — в правилах публикации в панели аптеки.`,
    );
  }
}
