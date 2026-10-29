import { cfg, assertConfig } from './config.js';
import { createBot, setupMenu } from './bot.js';
import { createApp } from './miniapp.js';
import { startScheduler } from './scheduler.js';
import { loadEmojiMap } from './store.js';

assertConfig();
const bot = createBot();
const app = createApp(bot.api);

const server = app.listen(cfg.port, () => console.log(`[web] http://localhost:${cfg.port}  мини-приложение: ${cfg.publicUrl || '(задай PUBLIC_URL)'}/app/`));

await loadEmojiMap().catch((e) => console.warn('[emoji]', e.message));
startScheduler(bot.api);
await setupMenu(bot);

const stop = () => { server.close(); bot.stop(); process.exit(0); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);

await bot.start({ onStart: (me) => console.log(`[bot] @${me.username} запущен, админы: ${[...cfg.adminIds].join(', ')}`) });
