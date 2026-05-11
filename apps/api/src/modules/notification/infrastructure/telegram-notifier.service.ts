import { Injectable, Logger } from '@nestjs/common';
import { config } from '@core/config/env.config';

/**
 * Inline keyboard button. Один из {callback_data, web_app, url} обязателен.
 * - `callback_data` → bot callback_query handler
 * - `web_app` → opens Mini App с Telegram initData injected (auth работает)
 * - `url` → opens link в external browser БЕЗ initData
 */
export interface InlineButton {
  text: string;
  callback_data?: string;
  web_app?: { url: string };
  url?: string;
}

export interface SendMessageOptions {
  /** Two-dimensional array — rows of buttons. */
  inlineKeyboard?: InlineButton[][];
}

/**
 * Escape user-controlled strings before interpolating в HTML-formatted DMs.
 * Telegram parse_mode='HTML' supports limited tag set (b/i/code/etc); any raw
 * `&<>` в user input ломают rendering либо валит Telegram API на 400.
 * Применять на ВСЕ user-input fields: admin reason, buyer phone, pharmacy name,
 * product names, etc.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramNotifierService {
  private readonly logger = new Logger(TelegramNotifierService.name);
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}`;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    try {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      };
      if (options.inlineKeyboard) {
        body.reply_markup = { inline_keyboard: options.inlineKeyboard };
      }

      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const respBody = await response.text();
        this.logger.warn(`Telegram API error for chat ${chatId}: ${respBody}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}`, error);
    }
  }
}
