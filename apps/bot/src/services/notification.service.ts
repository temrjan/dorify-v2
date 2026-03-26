import type { Bot, Context } from 'grammy';

export class NotificationService {
  constructor(private readonly bot: Bot<Context>) {}

  async notifyBuyer(telegramId: number, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`Failed to notify buyer ${telegramId}:`, error);
    }
  }

  async notifyPharmacy(telegramId: number, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`Failed to notify pharmacy ${telegramId}:`, error);
    }
  }

  async notifyAdmins(message: string, adminChatIds: number[]): Promise<void> {
    for (const chatId of adminChatIds) {
      try {
        await this.bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Failed to notify admin ${chatId}:`, error);
      }
    }
  }
}
