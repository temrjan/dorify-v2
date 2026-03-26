import { Bot } from 'grammy';
import express from 'express';
import { config } from './config';
import { registerCommands } from './commands';

async function main(): Promise<void> {
  // 1. Create bot
  const bot = new Bot(config.BOT_TOKEN);

  // 2. Error handler (v1 audit fix: bot had no error handler)
  bot.catch((err) => {
    console.error('Bot error:', err.message);
    console.error('Context:', err.ctx?.update?.update_id);
  });

  // 3. Register commands
  registerCommands(bot);

  // 4. Set bot commands menu
  await bot.api.setMyCommands([
    { command: 'start', description: 'Главное меню' },
    { command: 'help', description: 'Справка' },
  ]);

  // 5. Health check HTTP server
  const healthApp = express();
  healthApp.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'dorify-bot' });
  });
  healthApp.listen(config.HEALTH_PORT, () => {
    console.log(`Health check on port ${config.HEALTH_PORT}`);
  });

  // 6. Start polling
  console.log('Dorify Bot starting...');
  await bot.start({
    onStart: () => console.log('Dorify Bot is running'),
  });
}

// Graceful shutdown
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
