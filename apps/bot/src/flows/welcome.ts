import { Composer } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import { detectLang, t, type Lang } from '../i18n';
import { languageKeyboard, roleKeyboard, webAppKeyboard } from '../keyboards';

export interface SessionData {
  lang?: Lang;
}

export type BotContext = Context & SessionFlavor<SessionData>;

/**
 * Resolve current language: explicit session choice wins, otherwise auto-detect
 * from Telegram's `language_code` field.
 */
function resolveLang(ctx: BotContext): Lang {
  return ctx.session.lang ?? detectLang(ctx.from?.language_code);
}

async function showRoleChoice(ctx: BotContext, lang: Lang): Promise<void> {
  const name = ctx.from?.first_name ?? '';
  await ctx.reply(t(lang, 'welcome.greeting', { name }), {
    reply_markup: roleKeyboard(lang),
  });
}

export const welcome = new Composer<BotContext>();

// /start — entry point
welcome.command('start', async (ctx) => {
  if (!ctx.session.lang) {
    await ctx.reply(t('ru', 'welcome.chooseLanguage'), {
      reply_markup: languageKeyboard(),
    });
    return;
  }
  await showRoleChoice(ctx, ctx.session.lang);
});

// /language — re-prompt language picker
welcome.command('language', async (ctx) => {
  const lang = resolveLang(ctx);
  await ctx.reply(t(lang, 'language.chooseToSwitch'), {
    reply_markup: languageKeyboard(),
  });
});

// /help — translated help
welcome.command('help', async (ctx) => {
  const lang = resolveLang(ctx);
  const text = [
    t(lang, 'help.title'),
    '',
    t(lang, 'help.start'),
    t(lang, 'help.language'),
    t(lang, 'help.helpCmd'),
    '',
    t(lang, 'help.footer'),
  ].join('\n');
  await ctx.reply(text);
});

// Language selection
welcome.callbackQuery(/^lang:(ru|uz)$/, async (ctx) => {
  const chosen = ctx.match[1] as Lang;
  ctx.session.lang = chosen;
  await ctx.answerCallbackQuery(t(chosen, 'welcome.languageSet'));
  // Replace inline keyboard with role choice in same message thread
  await ctx.editMessageText(t(chosen, 'welcome.languageSet'));
  await showRoleChoice(ctx, chosen);
});

// Role: buyer → catalog WebApp
welcome.callbackQuery('role:buyer', async (ctx) => {
  const lang = resolveLang(ctx);
  await ctx.answerCallbackQuery();
  await ctx.reply(t(lang, 'welcome.openCatalogPrompt'), {
    reply_markup: webAppKeyboard(t(lang, 'welcome.openCatalog'), '/'),
  });
});

// Role: pharmacy registration → wizard WebApp
welcome.callbackQuery('role:pharmacy', async (ctx) => {
  const lang = resolveLang(ctx);
  await ctx.answerCallbackQuery();
  await ctx.reply(t(lang, 'welcome.openRegistrationPrompt'), {
    reply_markup: webAppKeyboard(t(lang, 'welcome.openRegistration'), '/become-pharmacy'),
  });
});
