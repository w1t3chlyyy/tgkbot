import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { cfg, ROOT } from './config.js';
import { posts, plan, getRuntime, getSetting, setSetting, saveEmojiPack, loadEmojiMap, DEFAULT_LINKS } from './store.js';
import { listCatalog, searchRows } from './sources.js';
import { generatePost, generatePlan } from './post.js';
import { renderBanner, normalizeBanner } from './banner.js';
import { sanitizeHtml } from './html.js';
import { showDraft } from './draft.js';
import { publishPost } from './publisher.js';
import { zonedToUtc, nowIn, addDays } from './tz.js';
import { OBJECTS, WORDS, LAYOUTS, DEFAULT_STYLE } from './prompts.js';

/** Проверка подписи Telegram WebApp initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) */
export function verifyInitData(initData, token, maxAgeSec = 86400) {
  if (!initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const data = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = crypto.createHmac('sha256', secret).update(data).digest();
  let given; try { given = Buffer.from(hash, 'hex'); } catch { return null; }
  if (given.length !== calc.length || !crypto.timingSafeEqual(given, calc)) return null;
  const age = Math.floor(Date.now() / 1000) - Number(p.get('auth_date') || 0);
  if (!(age >= 0 && age < maxAgeSec)) return null;
  try { return JSON.parse(p.get('user') || 'null'); } catch { return null; }
}

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error('[api]', e); res.status(400).json({ error: e.message }); });

export function createApp(api) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_, res) => res.json({ ok: true }));
  app.use('/app/fonts', express.static(path.join(ROOT, 'assets', 'fonts'), { maxAge: '30d' }));
  app.use('/app', express.static(path.join(ROOT, 'public', 'app')));
  app.get('/', (_, res) => res.redirect('/app/'));

  app.use('/api', (req, res, next) => {
    if (cfg.devNoAuth) { req.user = { id: [...cfg.adminIds][0] || 0 }; return next(); }
    const user = verifyInitData(req.get('X-Init-Data') || '', cfg.botToken);
    if (!user || !cfg.adminIds.has(user.id)) return res.status(401).json({ error: 'Нет доступа' });
    req.user = user; next();
  });

  app.get('/api/bootstrap', wrap(async (req, res) => {
    const rt = await getRuntime();
    res.json({
      user: req.user, settings: { ...rt, stylePrompt: (await getSetting('style_prompt')) || DEFAULT_STYLE, links: rt.links },
      emojiCount: (await loadEmojiMap()).size,
      options: { objects: OBJECTS, words: Object.keys(WORDS), layouts: LAYOUTS },
      sources: await listCatalog(),
    });
  }));

  /* источники */
  app.get('/api/sources', wrap(async (req, res) => res.json(await listCatalog(req.query.refresh === '1'))));
  app.get('/api/sources/rows', wrap(async (req, res) => res.json(await searchRows(String(req.query.db), String(req.query.table), String(req.query.q || '')))));

  /* баннер */
  app.post('/api/banner', wrap(async (req, res) => { res.type('png').send(renderBanner(normalizeBanner(req.body?.spec || {}))); }));

  /* посты */
  app.get('/api/posts', wrap(async (req, res) => res.json(await posts.list(String(req.query.status || 'draft,scheduled,failed,published')))));

  app.post('/api/posts/generate', wrap(async (req, res) => {
    const { topic, brief = '', refs = [], banner = {}, scheduleLocal } = req.body || {};
    if (!topic?.trim()) throw new Error('Укажи тему');
    const rt = await getRuntime();
    const gen = await generatePost({ topic: topic.trim(), brief, refs, overrides: { banner } });
    let scheduled_at = null;
    if (scheduleLocal) {
      const m = String(scheduleLocal).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (m) scheduled_at = zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], rt.tz).toISOString();
    }
    const post = await posts.create({ status: 'draft', topic: topic.trim(), brief, refs, html: gen.html, banner: gen.banner, buttons: gen.buttons, scheduled_at, admin_chat_id: req.user.id });
    await showDraft(api, req.user.id, post.id);
    res.json({ id: post.id });
  }));

  app.post('/api/posts/:id/chat', wrap(async (req, res) => { await showDraft(api, req.user.id, req.params.id); res.json({ ok: true }); }));
  app.post('/api/posts/:id/publish', wrap(async (req, res) => {
    const p = await posts.get(req.params.id);
    if (!p || p.status === 'published') throw new Error('Пост не найден или уже опубликован');
    res.json(await publishPost(api, p));
  }));
  app.patch('/api/posts/:id', wrap(async (req, res) => {
    const b = req.body || {}, patch = {};
    if (b.html != null) patch.html = sanitizeHtml(b.html);
    if (b.banner) patch.banner = normalizeBanner(b.banner);
    if (b.buttons) patch.buttons = b.buttons.slice(0, 3);
    if (b.scheduled_at !== undefined) patch.scheduled_at = b.scheduled_at;
    if (b.status && ['draft', 'scheduled', 'cancelled'].includes(b.status)) patch.status = b.status;
    if (patch.status === 'scheduled' && !(patch.scheduled_at || (await posts.get(req.params.id))?.scheduled_at)) throw new Error('Сначала укажи время');
    res.json(await posts.update(req.params.id, patch));
  }));
  app.delete('/api/posts/:id', wrap(async (req, res) => {
    const p = await posts.get(req.params.id);
    if (p?.status === 'published') throw new Error('Опубликованный пост удалить нельзя');
    await posts.remove(req.params.id); res.json({ ok: true });
  }));

  /* контент-план */
  app.get('/api/plan', wrap(async (_, res) => res.json(await plan.list())));
  app.post('/api/plan/generate', wrap(async (req, res) => {
    const rt = await getRuntime();
    const days = Math.min(Math.max(Number(req.body?.days) || 14, 1), 31);
    const n = nowIn(rt.tz); const t = addDays(n.y, n.m, n.d, 1);
    const start = req.body?.start || `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
    const items = await generatePlan({ days, start, focus: req.body?.focus || '' });
    if (!items.length) throw new Error('Qwen не вернул план, попробуй ещё раз');
    res.json(await plan.insertMany(items.map((i) => ({ day: i.day, topic: i.topic, brief: i.brief }))));
  }));
  app.post('/api/plan/:id/make', wrap(async (req, res) => {
    const item = await plan.get(req.params.id);
    if (!item) throw new Error('Пункт плана не найден');
    const rt = await getRuntime();
    const gen = await generatePost({ topic: item.topic, brief: item.brief, refs: item.refs || [], overrides: { banner: req.body?.banner || {} } });
    const [y, m, d] = item.day.split('-').map(Number); const [hh, mm] = rt.defaultTime.split(':').map(Number);
    const post = await posts.create({ status: 'draft', topic: item.topic, brief: item.brief, refs: item.refs || [], html: gen.html, banner: gen.banner, buttons: gen.buttons, scheduled_at: zonedToUtc(y, m, d, hh, mm, rt.tz).toISOString(), admin_chat_id: req.user.id });
    await plan.update(item.id, { status: 'made', post_id: post.id });
    await showDraft(api, req.user.id, post.id);
    res.json({ id: post.id });
  }));
  app.delete('/api/plan/:id', wrap(async (req, res) => { await plan.remove(req.params.id); res.json({ ok: true }); }));

  /* настройки */
  app.put('/api/settings', wrap(async (req, res) => {
    const b = req.body || {};
    if (b.channel != null) await setSetting('channel', String(b.channel).trim());
    if (b.tz) { try { new Intl.DateTimeFormat('ru', { timeZone: b.tz }); } catch { throw new Error('Неизвестный часовой пояс'); } await setSetting('tz', b.tz); }
    if (b.defaultTime && /^\d{1,2}:\d{2}$/.test(b.defaultTime)) await setSetting('default_time', b.defaultTime);
    if (b.customEmoji != null) await setSetting('custom_emoji', !!b.customEmoji);
    if (b.stylePrompt != null) await setSetting('style_prompt', String(b.stylePrompt));
    if (b.links) await setSetting('links', { ...DEFAULT_LINKS, ...b.links });
    res.json({ ok: true });
  }));
  app.post('/api/emoji/pack', wrap(async (req, res) => {
    const name = String(req.body?.name || '').replace(/^https?:\/\/t\.me\/addemoji\//i, '').replace(/[/?#].*$/, '');
    if (!name) throw new Error('Укажи ссылку или имя пака');
    const set = await api.getStickerSet(name);
    if (set.sticker_type !== 'custom_emoji') throw new Error('Это не пак эмодзи (нужна ссылка t.me/addemoji/…)');
    res.json({ count: await saveEmojiPack(name, set.stickers), title: set.title });
  }));

  return app;
}
