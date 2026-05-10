import { ru } from './ru';
import { uz } from './uz';
import type { Translations } from './ru';

export type Lang = 'ru' | 'uz';

const DICTIONARIES: Record<Lang, Translations> = { ru, uz };

/**
 * Detects default language from Telegram's `language_code` field.
 * Returns 'uz' for Uzbek users, 'ru' otherwise (covers ru, en, plus
 * unrecognized locales — Russian is the primary fallback).
 */
export function detectLang(telegramLanguageCode: string | undefined): Lang {
  return telegramLanguageCode === 'uz' ? 'uz' : 'ru';
}

/**
 * Lookup a translated string. `keyPath` is dot-separated (e.g.
 * `welcome.greeting`). Variables `{{name}}` are interpolated from `vars`.
 */
export function t(lang: Lang, keyPath: string, vars: Record<string, string> = {}): string {
  const dict = DICTIONARIES[lang];
  const value = keyPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);

  if (typeof value !== 'string') {
    // Missing key — return path so it's visible in production logs/UI.
    return keyPath;
  }

  return Object.entries(vars).reduce(
    (str, [name, val]) => str.replace(new RegExp(`{{${name}}}`, 'g'), val),
    value,
  );
}
