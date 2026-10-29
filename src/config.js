import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function json(name, def) {
  const raw = process.env[name];
  if (!raw) return def;
  try { return JSON.parse(raw); } catch (e) { throw new Error(`Переменная ${name} содержит некорректный JSON: ${e.message}`); }
}

export const cfg = {
  botToken: process.env.BOT_TOKEN || '',
  adminIds: new Set((process.env.ADMIN_IDS || '').split(',').map((s) => Number(s.trim())).filter(Boolean)),
  channelId: process.env.CHANNEL_ID || '',
  publicUrl: (process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/$/, ''),
  cronSecret: process.env.CRON_SECRET || '',
  port: Number(process.env.PORT || 3000),
  tz: process.env.TZ_DEFAULT || 'Europe/Moscow',
  supabase: { url: process.env.SUPABASE_URL || '', key: process.env.SUPABASE_KEY || '' },
  qwen: {
    key: process.env.QWEN_API_KEY || '',
    base: (process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
    model: process.env.QWEN_MODEL || 'qwen-plus',
  },
  databases: json('DATABASES', []),
  stylePromptSource: json('STYLE_PROMPT_SOURCE', null),
  tgApiRoot: process.env.TELEGRAM_API_ROOT || '',
  devNoAuth: process.env.DEV_NO_AUTH === '1',
};

export function assertConfig() {
  const miss = [];
  if (!cfg.botToken) miss.push('BOT_TOKEN');
  if (!cfg.adminIds.size) miss.push('ADMIN_IDS');
  if (!cfg.supabase.url || !cfg.supabase.key) miss.push('SUPABASE_URL / SUPABASE_KEY');
  if (!cfg.qwen.key) miss.push('QWEN_API_KEY');
  if (!cfg.cronSecret) miss.push('CRON_SECRET');
  if (miss.length) throw new Error('Не заполнено в .env: ' + miss.join(', '));
}
