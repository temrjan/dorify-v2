import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { config } from '@core/config/env.config';
import { TelegramNotifierService } from '../../infrastructure/telegram-notifier.service';
import { USER_REPOSITORY } from '../../../iam/domain/repositories/user.repository';
import type { UserRepository } from '../../../iam/domain/repositories/user.repository';
import type {
  PharmacyCreatedEvent,
  PharmacyVerifiedEvent,
  PharmacyRejectedEvent,
} from '../../../iam/domain/events';

@Injectable()
export class PharmacyNotificationHandler {
  private readonly logger = new Logger(PharmacyNotificationHandler.name);

  constructor(
    private readonly notifier: TelegramNotifierService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  /**
   * New pharmacy registered → DM each admin with approve/reject buttons.
   * Bot handles the callback_query (apps/bot/src/flows/admin-approval.ts)
   * and calls back via X-Service-Token to /admin/pharmacies/:id/{verify,reject}.
   */
  @OnEvent('pharmacy.created')
  async onPharmacyCreated(event: PharmacyCreatedEvent): Promise<void> {
    const { pharmacyId, ownerId, name, slug } = event.payload;
    const admins = config.ADMIN_CHAT_IDS;

    if (admins.length === 0) {
      this.logger.warn(
        `pharmacy.created (${pharmacyId}): no ADMIN_CHAT_IDS configured — approval flow stalled`,
      );
      return;
    }

    const owner = await this.userRepo.findById(ownerId);
    const ownerLine = owner ? `@${owner.username ?? owner.firstName}` : ownerId;

    const text =
      `🏪 <b>Новая заявка на регистрацию аптеки</b>\n\n` +
      `<b>${name}</b>\n` +
      `URL: <code>${slug}</code>\n` +
      `Владелец: ${ownerLine}\n\n` +
      `Проверьте данные и одобрите либо отклоните.`;

    const keyboard = [
      [
        { text: '✓ Одобрить', callback_data: `pharmacy:approve:${pharmacyId}` },
        { text: '✗ Отклонить', callback_data: `pharmacy:reject:${pharmacyId}` },
      ],
    ];

    for (const chatId of admins) {
      await this.notifier.sendMessage(chatId, text, { inlineKeyboard: keyboard });
    }
    this.logger.log(`Notified ${admins.length} admin(s) about pharmacy ${pharmacyId}`);
  }

  /** Pharmacy approved — DM owner с web_app button (initData injected). */
  @OnEvent('pharmacy.verified')
  async onPharmacyVerified(event: PharmacyVerifiedEvent): Promise<void> {
    const owner = await this.userRepo.findById(event.payload.ownerId);
    if (!owner) return;

    await this.notifier.sendMessage(
      owner.telegramId.toString(),
      `✅ <b>Аптека одобрена</b>\n\n` +
        `<b>${event.payload.name}</b> прошла модерацию. Откройте панель чтобы добавить товары.`,
      {
        inlineKeyboard: [
          [
            {
              text: '🏪 Открыть панель аптеки',
              web_app: { url: `${config.WEB_URL.replace(/\/+$/, '')}/pharmacy` },
            },
          ],
        ],
      },
    );
  }

  /** Pharmacy rejected — DM owner with reason. */
  @OnEvent('pharmacy.rejected')
  async onPharmacyRejected(event: PharmacyRejectedEvent): Promise<void> {
    const owner = await this.userRepo.findById(event.payload.ownerId);
    if (!owner) return;

    await this.notifier.sendMessage(
      owner.telegramId.toString(),
      `❌ <b>Заявка отклонена</b>\n\n` +
        `Причина: ${event.payload.reason}\n\n` +
        `Вы можете подать заявку повторно с обновлёнными данными.`,
    );
  }
}
