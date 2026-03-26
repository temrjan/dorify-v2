import { Injectable, Logger } from '@nestjs/common';
import { config } from '@core/config/env.config';

@Injectable()
export class TelegramNotifierService {
  private readonly logger = new Logger(TelegramNotifierService.name);
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}`;
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`Telegram API error for chat ${chatId}: ${body}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}`, error);
    }
  }
}
