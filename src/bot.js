import { Telegraf, Markup } from 'telegraf';

export function createBot({ token, webAppUrl }) {
  if (!token) {
    throw new Error('BOT_TOKEN is required');
  }

  if (!webAppUrl) {
    throw new Error('WEB_APP_URL is required');
  }

  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    const name = ctx.from?.first_name ?? 'герой';
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Запустить космораннер', webAppUrl)]
    ]);

    await ctx.reply(
      `Привет, ${name}!\n` +
        'Добро пожаловать в неоновый раннер Web3. Прыгай, собирай комбо и делись рекордами!\n' +
        'Нажми на кнопку ниже, чтобы открыть игру прямо в Telegram.',
      keyboard
    );
  });

  bot.command('help', (ctx) =>
    ctx.reply(
      'Это Web3 мини-приложение с игрой в стиле динозавра. \n' +
        'Открой WebApp, чтобы сыграть и поделиться результатом. '
    )
  );

  bot.on('web_app_data', (ctx) => {
    try {
      const data = JSON.parse(ctx.webAppData.data);
      if (data.type === 'score') {
        const { score, comboMax } = data;
        return ctx.reply(
          `🔥 Комбо: ${comboMax}\n🏆 Рекорд: ${score}\n` +
            'Ты можешь сохранить результат, нажав «Запустить космораннер» и сыграв снова!'
        );
      }
    } catch (error) {
      console.error('Failed to parse web app data', error);
    }
    return ctx.reply('Получены данные из мини-приложения!');
  });

  return bot;
}
