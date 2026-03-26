import type { Bot, Context } from 'grammy';
import { mainMenuKeyboard, backToMenuKeyboard } from '../keyboards';

export function registerCommands(bot: Bot<Context>): void {
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name ?? 'друг';
    await ctx.reply(
      `Добро пожаловать в Dorify, ${name}! 💊\n\n` +
      'Аптечный маркетплейс — лекарства с доставкой из ближайших аптек.\n\n' +
      'Выберите действие:',
      { reply_markup: mainMenuKeyboard },
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📋 Команды:\n\n' +
      '/start — Главное меню\n' +
      '/help — Справка\n\n' +
      'Для покупки лекарств откройте маркетплейс кнопкой ниже.',
      { reply_markup: mainMenuKeyboard },
    );
  });

  // Callback queries
  bot.callbackQuery('main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      'Выберите действие:',
      { reply_markup: mainMenuKeyboard },
    );
  });

  bot.callbackQuery('about', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      'Dorify — мультитенантный маркетплейс аптек.\n\n' +
      '✓ Каталог лекарств из нескольких аптек\n' +
      '✓ Онлайн оплата через Multicard\n' +
      '✓ Доставка или самовывоз\n' +
      '✓ AI-поиск по каталогу',
      { reply_markup: backToMenuKeyboard },
    );
  });
}
