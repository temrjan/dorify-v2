import { Injectable, Logger } from '@nestjs/common';
import { config } from '@core/config/env.config';

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface SendMessageOptions {
  /** Two-dimensional array — rows of buttons. */
  inlineKeyboard?: InlineButton[][];
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
