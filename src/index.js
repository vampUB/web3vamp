import dotenv from 'dotenv';
import { createServer } from './server.js';
import { createBot } from './bot.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;

async function bootstrap() {
  const app = createServer();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const bot = createBot({ token: BOT_TOKEN, webAppUrl: WEB_APP_URL });
  await bot.launch();
  console.log('Telegram bot launched');

  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});
