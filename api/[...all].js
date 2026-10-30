// Единая точка входа для Vercel: вебхук Telegram, cron, API мини-приложения.
// Статика мини-приложения (public/app) отдаётся Vercel напрямую.
import { waitUntil } from '@vercel/functions';
import { assertConfig } from '../src/config.js';
import { createBot } from '../src/bot.js';
import { createApp } from '../src/miniapp.js';

let app;
export default function handler(req, res) {
  try {
    if (!app) {
      assertConfig();
      app = createApp(createBot(), { defer: (p) => waitUntil(p.catch((e) => console.error('[defer]', e.message))) });
    }
  } catch (e) {
    console.error('[init]', e.message);
    return res.status(500).json({ error: e.message });
  }
  return app(req, res);
}
