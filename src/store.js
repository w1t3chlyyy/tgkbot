import { cfg } from './config.js';
import { rest } from './db.js';

export const db = rest(cfg.supabase);

export const DEFAULT_LINKS = {
  site: 'https://hustlify.site',
  catalog: 'https://t.me/hustlifybot',
  cases: 'https://t.me/hustlifycasesbot',
  sales: 'https://t.me/hustlifysalerobot',
  support: 'https://t.me/HustlifyHelp',
};

/* ── настройки ── (кэш 3 с: в serverless несколько экземпляров, долгий кэш давал бы устаревшие значения) */
const cache = new Map();
const TTL = 3000;
export async function getSetting(key, def = null) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const rows = await db.select('settings', `key=eq.${encodeURIComponent(key)}&select=value`);
  const v = rows?.length ? rows[0].value : def;
  cache.set(key, { v, at: Date.now() });
  return v;
}
export async function setSetting(key, value) {
  await db.upsert('settings', [{ key, value }], 'key');
  cache.set(key, { v: value, at: Date.now() });
}
export async function getRuntime() {
  return {
    channel: (await getSetting('channel')) || cfg.channelId,
    tz: (await getSetting('tz')) || cfg.tz,
    defaultTime: (await getSetting('default_time')) || '18:00',
    dailyTime: (await getSetting('daily_time')) || '10:00',
    dailyEnabled: (await getSetting('daily_enabled', true)) !== false,
    approver: Number(await getSetting('approver')) || [...cfg.adminIds][0],
    customEmoji: (await getSetting('custom_emoji', true)) !== false,
    links: { ...DEFAULT_LINKS, ...((await getSetting('links')) || {}) },
  };
}

/* ── состояние диалога («жду текст правки», «жду время»…) — в базе, а не в памяти ── */
export async function getState(chatId) {
  const r = await db.select('settings', `key=eq.state:${chatId}&select=value`);
  return r?.[0]?.value || null;
}
export const setState = (chatId, value) => db.upsert('settings', [{ key: `state:${chatId}`, value }], 'key');
export const clearState = (chatId) => db.remove('settings', `key=eq.state:${chatId}`);

/* ── защита от повторной доставки одного и того же update вебхуком ── */
export async function claimUpdate(updateId) {
  const r = await db.insertIgnore('processed_updates', { update_id: updateId }, 'update_id');
  return Array.isArray(r) && r.length > 0;
}
export const cleanupUpdates = () =>
  db.remove('processed_updates', `at=lt.${new Date(Date.now() - 2 * 86400_000).toISOString()}`).catch(() => {});

/* ── посты ── */
export const posts = {
  async create(p) { return (await db.insert('posts', p))[0]; },
  async get(id) { const r = await db.select('posts', `id=eq.${Number(id)}`); return r[0] || null; },
  async update(id, patch) { const r = await db.update('posts', `id=eq.${Number(id)}`, patch); return r[0] || null; },
  async remove(id) { await db.remove('posts', `id=eq.${Number(id)}`); },
  async list(status) {
    const f = status ? `status=in.(${status})&` : '';
    return db.select('posts', `${f}order=created_at.desc&limit=100`);
  },
  async due() {
    return db.select('posts', `status=eq.scheduled&scheduled_at=lte.${new Date().toISOString()}&order=scheduled_at.asc&limit=10`);
  },
  // атомарно «забираем» запланированный пост (cron), чтобы не опубликовать дважды
  async claim(id) {
    const r = await db.update('posts', `id=eq.${Number(id)}&status=eq.scheduled`, { status: 'publishing' });
    return r?.[0] || null;
  },
  // то же для ручной публикации (кнопка в боте / мини-приложение): двойной тап не даёт дубль
  async claimPublish(id) {
    const r = await db.update('posts', `id=eq.${Number(id)}&status=in.(draft,scheduled,failed)`, { status: 'publishing' });
    return r?.[0] || null;
  },
};

/* ── план ── */
export const plan = {
  list: () => db.select('plan_items', 'order=day.asc,id.asc&limit=300'),
  async get(id) { return (await db.select('plan_items', `id=eq.${Number(id)}`))[0] || null; },
  insertMany: (rows) => db.insert('plan_items', rows),
  async update(id, patch) { return (await db.update('plan_items', `id=eq.${Number(id)}`, patch))[0]; },
  remove: (id) => db.remove('plan_items', `id=eq.${Number(id)}`),
  // перед загрузкой нового плана заменяем ещё не сделанные пункты на те же даты
  clearOpen: (days) => days.length ? db.remove('plan_items', `day=in.(${days.join(',')})&status=in.(idea,failed)`) : null,
  clearAllOpen: () => db.remove('plan_items', 'status=in.(idea,failed)'),
  forDay: (day, statuses = ['idea']) => db.select('plan_items', `day=eq.${day}&status=in.(${statuses.join(',')})&order=id.asc&limit=1`),
  // атомарно «забираем» пункт, чтобы два параллельных вызова cron не сделали пост дважды
  async claim(id, from = ['idea']) {
    const r = await db.update('plan_items', `id=eq.${Number(id)}&status=in.(${from.join(',')})`, { status: 'making' });
    return r?.[0] || null;
  },
};

/* ── эмодзи-пак ── */
let emojiMap = null, emojiAt = 0;
const base = (e) => e.replace(/\uFE0F/g, '');
export async function loadEmojiMap(force = false) {
  if (emojiMap && !force && Date.now() - emojiAt < 60_000) return emojiMap;
  const rows = [];
  // Supabase отдаёт максимум 1000 строк за запрос — листаем страницами
  for (let off = 0; off < 5000; off += 1000) {
    const part = await db.select('emoji', `order=pack.asc,idx.asc&limit=1000&offset=${off}`);
    rows.push(...part);
    if (part.length < 1000) break;
  }
  emojiMap = new Map(); emojiAt = Date.now();
  for (const r of rows) {
    const k = base(r.emoji);
    if (!emojiMap.has(k)) emojiMap.set(k, r.custom_emoji_id); // первый из пака для каждого базового эмодзи
  }
  return emojiMap;
}
export async function saveEmojiPack(pack, stickers) {
  await db.remove('emoji', `pack=eq.${encodeURIComponent(pack)}`);
  const rows = stickers.filter((s) => s.custom_emoji_id).map((s, i) => ({ custom_emoji_id: s.custom_emoji_id, emoji: s.emoji, pack, idx: i }));
  for (let i = 0; i < rows.length; i += 200) await db.upsert('emoji', rows.slice(i, i + 200), 'custom_emoji_id');
  await loadEmojiMap(true);
  return rows.length;
}
