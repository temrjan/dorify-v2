import { InlineKeyboard } from 'grammy';
import { config } from '../config';

export const mainMenuKeyboard = new InlineKeyboard()
  .webApp('Открыть маркетплейс', config.WEBAPP_URL)
  .row()
  .webApp('Панель аптеки', `${config.WEBAPP_URL}/pharmacy`)
  .row()
  .text('О сервисе', 'about');

export const backToMenuKeyboard = new InlineKeyboard()
  .text('← Главное меню', 'main_menu');
