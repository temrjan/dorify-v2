import { InlineKeyboard } from 'grammy';
import { config } from '../config';
import { t, type Lang } from '../i18n';

/**
 * Language picker — shown on first /start (no session.lang) and via /language.
 * Both labels visible in both langs (so user without lang can read them).
 */
export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇷🇺 Русский", 'lang:ru')
    .text("🇺🇿 O'zbek", 'lang:uz');
}

/**
 * Role choice — buyer (open catalog) vs pharmacy registration (open wizard).
 * Both reply with separate `WebApp` buttons in the next message.
 */
export function roleKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'welcome.roleBuyer'), 'role:buyer')
    .row()
    .text(t(lang, 'welcome.roleRegisterPharmacy'), 'role:pharmacy');
}

/** Single WebApp button — sent after role selection. */
export function webAppKeyboard(label: string, path: string): InlineKeyboard {
  const url = `${config.WEBAPP_URL.replace(/\/+$/, '')}${path}`;
  return new InlineKeyboard().webApp(label, url);
}
