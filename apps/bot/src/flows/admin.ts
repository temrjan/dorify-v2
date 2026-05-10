import { Composer } from 'grammy';
import { config } from '../config';
import { adminApi } from '../services/admin-api';
import type { BotContext } from './welcome';

const APPROVE_RE = /^pharmacy:approve:(.+)$/;
const REJECT_RE = /^pharmacy:reject:(.+)$/;
const REASON_MAX = 500;

function isAdmin(chatId: number | undefined): boolean {
  if (chatId === undefined) return false;
  return config.ADMIN_CHAT_IDS.includes(chatId);
}

export const admin = new Composer<BotContext>();

// Approve: single tap → API call → reply confirmation, edit original message.
admin.callbackQuery(APPROVE_RE, async (ctx) => {
  if (!isAdmin(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: 'Доступ только для админов', show_alert: true });
    return;
  }
  const pharmacyId = ctx.match[1];
  try {
    await adminApi.verifyPharmacy(pharmacyId);
    await ctx.answerCallbackQuery('✓ Одобрено');
    if (ctx.callbackQuery.message) {
      await ctx.editMessageText(
        (ctx.callbackQuery.message.text ?? '') + '\n\n<b>✓ Одобрено</b>',
        { parse_mode: 'HTML' },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await ctx.answerCallbackQuery({ text: `Ошибка: ${msg}`, show_alert: true });
  }
});

// Reject step 1: button tap → ask for reason, store pharmacyId in session.
admin.callbackQuery(REJECT_RE, async (ctx) => {
  if (!isAdmin(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: 'Доступ только для админов', show_alert: true });
    return;
  }
  const pharmacyId = ctx.match[1];
  ctx.session.pendingRejectPharmacyId = pharmacyId;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    'Введите причину отклонения одним сообщением (до 500 символов).\n' +
      'Отправьте /cancel чтобы отменить.',
  );
});

// Reject step 2: capture next text message as reason.
admin.on('message:text', async (ctx, next) => {
  const pharmacyId = ctx.session.pendingRejectPharmacyId;
  if (!pharmacyId || !isAdmin(ctx.from?.id)) {
    return next();
  }

  const text = ctx.message.text.trim();
  if (text === '/cancel') {
    delete ctx.session.pendingRejectPharmacyId;
    await ctx.reply('Отклонение отменено.');
    return;
  }

  if (text.length === 0 || text.length > REASON_MAX) {
    await ctx.reply(`Причина должна быть от 1 до ${REASON_MAX} символов.`);
    return;
  }

  delete ctx.session.pendingRejectPharmacyId;

  try {
    await adminApi.rejectPharmacy(pharmacyId, text);
    await ctx.reply(`✗ Заявка отклонена. Причина передана продавцу.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await ctx.reply(`Ошибка отклонения: ${msg}`);
  }
});
