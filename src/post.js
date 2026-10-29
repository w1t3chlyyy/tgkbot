import { chatJSON } from './qwen.js';
import { systemPrompt, planPrompt, DEFAULT_STYLE } from './prompts.js';
import { sanitizeHtml, visibleLen, availableEmoji } from './html.js';
import { normalizeBanner } from './banner.js';
import { getSetting, getRuntime } from './store.js';
import { materialFromRefs, overview, fetchStylePrompt } from './sources.js';

async function stylePrompt() {
  return (await getSetting('style_prompt')) || (await fetchStylePrompt()) || DEFAULT_STYLE;
}

function allowedUrls(links, material) {
  const set = new Set(Object.values(links).map((u) => u.replace(/\/$/, '')));
  for (const m of material.matchAll(/https?:\/\/[^\s"'<>)]+/g)) set.add(m[0].replace(/[.,;]+$/, '').replace(/\/$/, ''));
  return set;
}

function normalize(raw, { links, material, fallbackBanner = {}, prev = null }) {
  let html = sanitizeHtml(raw.html || prev?.html || '');
  if (!html) throw new Error('Qwen не вернул текст поста');
  const ok = allowedUrls(links, material);
  let buttons = (Array.isArray(raw.buttons) ? raw.buttons : prev?.buttons || [])
    .filter((b) => b?.text && b?.url && ok.has(String(b.url).replace(/\/$/, '')))
    .slice(0, 3).map((b) => ({ text: String(b.text).slice(0, 32), url: String(b.url) }));
  if (!buttons.length) buttons = [{ text: 'Открыть Hustlify', url: links.site }];
  const banner = normalizeBanner(raw.banner || {}, { ...(prev?.banner || {}), ...fallbackBanner });
  return { html, buttons, banner };
}

/** Новый пост по теме/тезисам/источникам. overrides.banner — то, что админ выбрал руками (приоритетнее Qwen). */
export async function generatePost({ topic, brief = '', refs = [], overrides = {} }) {
  const rt = await getRuntime();
  const material = await materialFromRefs(refs);
  const emojis = (await availableEmoji()).slice(0, 80);
  const sys = systemPrompt({ style: await stylePrompt(), emojis, links: rt.links });
  const user = `ТЕМА: ${topic}\n${brief ? `ТЕЗИСЫ: ${brief}\n` : ''}${material ? `\nМАТЕРИАЛ ИЗ БАЗ:\n${material}\n` : ''}\nНапиши пост и данные баннера.`;
  const raw = await chatJSON([{ role: 'system', content: sys }, { role: 'user', content: user }]);
  const lockedBanner = Object.fromEntries(Object.entries(overrides.banner || {}).filter(([, v]) => v));
  const out = normalize(raw, { links: rt.links, material });
  out.banner = normalizeBanner({ ...out.banner, ...lockedBanner });
  return out;
}

/** Правка по инструкции админа («сделай короче», «добавь про 24 часа», «смени баннер на тёмный»). */
export async function revisePost(post, instruction, refs = post.refs || []) {
  const rt = await getRuntime();
  const material = await materialFromRefs(refs);
  const emojis = (await availableEmoji()).slice(0, 80);
  const sys = systemPrompt({ style: await stylePrompt(), emojis, links: rt.links });
  const current = JSON.stringify({ html: post.html, banner: post.banner, buttons: post.buttons });
  const user = `ТЕКУЩИЙ ПОСТ (JSON): ${current}\n${material ? `\nМАТЕРИАЛ ИЗ БАЗ:\n${material}\n` : ''}\nПРАВКА ОТ РЕДАКТОРА: ${instruction}\n\nВнеси только запрошенные изменения, остальное сохрани. Верни полный JSON поста в том же формате.`;
  const raw = await chatJSON([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.5 });
  return normalize(raw, { links: rt.links, material, prev: post });
}

/** Контент-план на N дней по реальным материалам баз. */
export async function generatePlan({ days = 14, start, focus = '' }) {
  const rt = await getRuntime();
  const ctx = await overview();
  const sys = 'Ты — контент-стратег Telegram-канала. Отвечай только JSON-объектом.';
  const user = `${planPrompt({ days, start, focus, links: rt.links })}\n\nМАТЕРИАЛЫ ИЗ БАЗ:\n${ctx || '(базы не подключены — опирайся на тему канала)'}`;
  const raw = await chatJSON([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.8, maxTokens: 3500 });
  const items = (raw.items || []).filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.day) && i.topic);
  return items.slice(0, days).map((i) => ({ day: i.day, topic: String(i.topic).slice(0, 200), brief: String(i.brief || '').slice(0, 800) }));
}

export { visibleLen };
