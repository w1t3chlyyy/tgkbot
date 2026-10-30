// Запуск на обычном сервере (Render, VPS, Docker): long polling + таймер внутри процесса.
// Для Vercel используется api/[...all].js (вебхук + внешний cron), этот файл там не нужен.
import { cfg, assertConfig } from './config.js';
import { createBot, setupMenu } from './bot.js';
import { createApp } from './miniapp.js';
import { startInterval } from './scheduler.js';
import { loadEmojiMap } from './store.js';

assertConfig();
const bot = createBot();
const app = createApp(bot);
const server = app.listen(cfg.port, () => console.log(`[web] http://localhost:${cfg.port}  мини-приложение: ${cfg.publicUrl || '(задай PUBLIC_URL)'}/app/`));

await loadEmojiMap().catch((e) => console.warn('[emoji]', e.message));
await bot.api.deleteWebhook().catch(() => {}); // polling и вебхук взаимоисключающие
startInterval(bot.api);
await setupMenu(bot);

const stop = () => { server.close(); bot.stop(); process.exit(0); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
for (;;) {
  try {
    await bot.start({ onStart: (me) => console.log(`[bot] @${me.username} запущен (polling), админы: ${[...cfg.adminIds].join(', ')}`) });
    break;
  } catch (e) {
    const isConflict = e?.error_code === 409 || e?.description?.includes('Conflict') || String(e?.message).includes('409');
    if (isConflict) {
      console.warn('[bot] 409: бота опрашивает другая копия или активен вебхук, повтор через 5 с');
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    console.error('[bot start error]', e?.message || e);
    await new Promise((r) => setTimeout(r, 10000));
  }
}
