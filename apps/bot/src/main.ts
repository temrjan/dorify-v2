import { Bot, session } from 'grammy';
import express from 'express';
import { config } from './config';
import { welcome, type BotContext, type SessionData } from './flows/welcome';
import { admin } from './flows/admin';

async function main(): Promise<void> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  // Session middleware — required by stateful flows. In-memory storage:
  // bot restart loses lang preferences, users re-asked language. Acceptable
  // tradeoff для Day 1; persistent storage (file/Redis) — Sprint 1 Day 5.
  bot.use(
    session<SessionData, BotContext>({
      initial: () => ({}),
    }),
  );

  // Admin composer first — its message:text catcher passes through `next()`
  // when no pending reject, so welcome composer still handles non-admin text.
  bot.use(admin);
  bot.use(welcome);

  bot.catch((err) => {
    console.error('Bot error:', err.message);
    console.error('Update:', err.ctx?.update?.update_id);
  });

  await bot.api.setMyCommands([
    { command: 'start', description: 'Главное меню / Asosiy menyu' },
    { command: 'language', description: 'Сменить язык / Tilni almashtirish' },
    { command: 'help', description: 'Справка / Yordam' },
  ]);

  // Health check HTTP server
  const healthApp = express();
  healthApp.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'dorify-bot' });
  });
  healthApp.listen(config.HEALTH_PORT, () => {
    console.log(`Health check on port ${config.HEALTH_PORT}`);
  });

  console.log('Dorify Bot starting...');
  await bot.start({
    onStart: () => console.log('Dorify Bot is running'),
  });
}

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
