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

/* ── настройки ── */
const cache = new Map();
export async function getSetting(key, def = null) {
  if (cache.has(key)) return cache.get(key);
  const rows = await db.select('settings', `key=eq.${encodeURIComponent(key)}&select=value`);
  const v = rows?.length ? rows[0].value : def;
  cache.set(key, v);
  return v;
}
export async function setSetting(key, value) {
  await db.upsert('settings', [{ key, value }], 'key');
  cache.set(key, value);
}
export async function getRuntime() {
  return {
    channel: (await getSetting('channel')) || cfg.channelId,
    tz: (await getSetting('tz')) || cfg.tz,
    defaultTime: (await getSetting('default_time')) || '18:00',
    customEmoji: (await getSetting('custom_emoji', true)) !== false,
    links: { ...DEFAULT_LINKS, ...((await getSetting('links')) || {}) },
  };
}

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
  // атомарно «забираем» пост, чтобы не опубликовать дважды
  async claim(id) {
    const r = await db.update('posts', `id=eq.${Number(id)}&status=eq.scheduled`, { status: 'publishing' });
    return r?.[0] || null;
  },
};

/* ── план ── */
export const plan = {
  list: () => db.select('plan_items', 'order=day.asc,id.asc&limit=200'),
  async get(id) { return (await db.select('plan_items', `id=eq.${Number(id)}`))[0] || null; },
  insertMany: (rows) => db.insert('plan_items', rows),
  async update(id, patch) { return (await db.update('plan_items', `id=eq.${Number(id)}`, patch))[0]; },
  remove: (id) => db.remove('plan_items', `id=eq.${Number(id)}`),
};

/* ── эмодзи-пак ── */
let emojiMap = null;
const base = (e) => e.replace(/\uFE0F/g, '');
export async function loadEmojiMap(force = false) {
  if (emojiMap && !force) return emojiMap;
  const rows = await db.select('emoji', 'order=pack.asc,idx.asc&limit=5000');
  emojiMap = new Map();
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
