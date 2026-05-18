import { Composer } from 'grammy';
import { config } from '../config';
import { adminApi } from '../services/admin-api';
import type { BotContext } from './welcome';

const APPROVE_RE = /^pharmacy:approve:(.+)$/;
const REJECT_RE = /^pharmacy:reject:(.+)$/;
const PRODUCT_HIDE_RE = /^product:hide:(.+)$/;
const REASON_MAX = 500;
/** Stale-reason TTL — после tap admin может уйти, а 5 мин спустя написать что-то
 * совершенно постороннее. Без TTL бот бы скрыл/отклонил по этой строке. */
const PENDING_REASON_TTL_MS = 5 * 60 * 1000;

function isAdmin(chatId: number | undefined): boolean {
  if (chatId === undefined) return false;
  return config.ADMIN_CHAT_IDS.includes(chatId);
}

function isStale(at: number | undefined): boolean {
  return at === undefined || Date.now() - at > PENDING_REASON_TTL_MS;
}

/**
 * Maps internal API errors to admin-facing messages. The common race is two
 * admins receiving the same DM and both clicking «Одобрить»/«Скрыть» — the
 * second one hits a DomainError. Surface that as friendly «уже обработано»
 * instead of leaking the raw English message.
 */
function friendlyApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/already verified|already processed|already hidden|Cannot reject|Cannot hide/i.test(msg)) {
    return 'Уже обработано другим админом.';
  }
  if (/not found/i.test(msg)) {
    return 'Запись не найдена (возможно, удалена).';
  }
  return `Ошибка: ${msg}`;
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
    await ctx.answerCallbackQuery({ text: friendlyApiError(err), show_alert: true });
  }
});

// Reject step 1: button tap → ask for reason, store pharmacyId + timestamp in
// session. Clears any pending product-hide so the two reason flows can't both
// be live simultaneously (mutual exclusion). Timestamp is consulted by the
// text handler — стейл prompt'ы (>5 мин) trapped and rolled back to next().
admin.callbackQuery(REJECT_RE, async (ctx) => {
  if (!isAdmin(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: 'Доступ только для админов', show_alert: true });
    return;
  }
  const pharmacyId = ctx.match[1];
  delete ctx.session.pendingHideProductId;
  delete ctx.session.pendingHideAt;
  ctx.session.pendingRejectPharmacyId = pharmacyId;
  ctx.session.pendingRejectAt = Date.now();
  await ctx.answerCallbackQuery();
  await ctx.reply(
    'Введите причину отклонения одним сообщением (до 500 символов).\n' +
      'Отправьте /cancel чтобы отменить. ' +
      'Запрос истечёт через 5 минут.',
  );
});

// Product hide step 1: same pattern — set id + timestamp, clear pharmacy-reject.
admin.callbackQuery(PRODUCT_HIDE_RE, async (ctx) => {
  if (!isAdmin(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: 'Доступ только для админов', show_alert: true });
    return;
  }
  const productId = ctx.match[1];
  delete ctx.session.pendingRejectPharmacyId;
  delete ctx.session.pendingRejectAt;
  ctx.session.pendingHideProductId = productId;
  ctx.session.pendingHideAt = Date.now();
  await ctx.answerCallbackQuery();
  await ctx.reply(
    'Введите причину скрытия товара одним сообщением (до 500 символов).\n' +
      'Аптека получит уведомление с этой причиной.\n' +
      'Отправьте /cancel чтобы отменить. ' +
      'Запрос истечёт через 5 минут.',
  );
});

// Reason capture: handles BOTH pharmacy reject и product hide flows.
// Determines which by inspecting session — only one can be active at a time.
// Stale prompts (>5 min) are silently cleared so an admin's unrelated later
// message doesn't get consumed as a reason.
admin.on('message:text', async (ctx, next) => {
  let pharmacyId = ctx.session.pendingRejectPharmacyId;
  let productId = ctx.session.pendingHideProductId;

  // TTL sweep — drop expired pendings, fall through to next handler as if no
  // reason flow was active.
  if (pharmacyId && isStale(ctx.session.pendingRejectAt)) {
    delete ctx.session.pendingRejectPharmacyId;
    delete ctx.session.pendingRejectAt;
    pharmacyId = undefined;
  }
  if (productId && isStale(ctx.session.pendingHideAt)) {
    delete ctx.session.pendingHideProductId;
    delete ctx.session.pendingHideAt;
    productId = undefined;
  }

  if ((!pharmacyId && !productId) || !isAdmin(ctx.from?.id)) {
    return next();
  }

  const text = ctx.message.text.trim();
  if (text === '/cancel') {
    delete ctx.session.pendingRejectPharmacyId;
    delete ctx.session.pendingRejectAt;
    delete ctx.session.pendingHideProductId;
    delete ctx.session.pendingHideAt;
    await ctx.reply('Действие отменено.');
    return;
  }

  if (text.length === 0 || text.length > REASON_MAX) {
    await ctx.reply(`Причина должна быть от 1 до ${REASON_MAX} символов.`);
    return;
  }

  if (pharmacyId) {
    delete ctx.session.pendingRejectPharmacyId;
    delete ctx.session.pendingRejectAt;
    try {
      await adminApi.rejectPharmacy(pharmacyId, text);
      await ctx.reply(`✗ Заявка отклонена. Причина передана продавцу.`);
    } catch (err) {
      await ctx.reply(friendlyApiError(err));
    }
    return;
  }

  if (productId) {
    delete ctx.session.pendingHideProductId;
    delete ctx.session.pendingHideAt;
    try {
      await adminApi.hideProduct(productId, text);
      await ctx.reply(`🗑 Товар скрыт. Аптека получила уведомление с причиной.`);
    } catch (err) {
      await ctx.reply(friendlyApiError(err));
    }
  }
});
