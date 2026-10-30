import { chatJSON } from './qwen.js';
import { systemPrompt, planPrompt, DEFAULT_STYLE } from './prompts.js';
import { sanitizeHtml, visibleLen, availableEmoji, restrictEmoji, stripTags } from './html.js';
import { normalizeBanner } from './banner.js';
import { fixHandles } from './handles.js';
import { getSetting, getRuntime } from './store.js';
import { materialFromRefs, overview, fetchStylePrompt } from './sources.js';

async function stylePrompt() {
  return (await getSetting('style_prompt')) || (await fetchStylePrompt()) || DEFAULT_STYLE;
}

const bare = (u) => String(u || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');

function allowedUrls(links, material) {
  const set = new Set(Object.values(links).map((u) => u.replace(/\/$/, '')));
  for (const m of material.matchAll(/https?:\/\/[^\s"'<>)]+/g)) set.add(m[0].replace(/[.,;]+$/, '').replace(/\/$/, ''));
  return set;
}

/** Страховка: Qwen часто ставит star/gem на посты не про Stars/Premium. Если иконка не по смыслу — подбираем по тексту. */
function fixIcon(obj, text) {
  const t = text.toLowerCase();
  if (obj === 'star' && !/stars|звёзд|звезд/.test(t)) obj = '';
  if (obj === 'gem' && !/premium|премиум/.test(t)) obj = '';
  if (obj) return obj;
  if (/видео|съ[её]мк|оператор/.test(t)) return 'play';
  if (/ваканси|набор|команд|продаж/.test(t)) return 'team';
  if (/кейс|результат|клиент/.test(t)) return 'case';
  if (/конкурс|итог|приз|рулетк/.test(t)) return 'trophy';
  if (/промокод|скидк/.test(t)) return 'tag';
  if (/возражен|диалог/.test(t)) return 'chat';
  return 'rocket';
}

function normalize(raw, { links, material, fallbackBanner = {}, prev = null, emojiSet = null }) {
  let html = sanitizeHtml(raw.html || prev?.html || '');
  if (!html) throw new Error('Qwen не вернул текст поста');
  html = fixHandles(html);               // @hustlifysalerobot → @HustlifySaleRobot
  html = restrictEmoji(html, emojiSet);  // только эмодзи из пака
  const ok = allowedUrls(links, material);
  let buttons = (Array.isArray(raw.buttons) ? raw.buttons : prev?.buttons || [])
    .filter((b) => b?.text && b?.url && ok.has(String(b.url).replace(/\/$/, '')))
    .slice(0, 3).map((b) => ({ text: String(b.text).slice(0, 32), url: String(b.url) }));
  if (!buttons.length) buttons = [{ text: 'Открыть Hustlify', url: links.site }];

  // ссылка на баннере: только из разрешённых; если Qwen исказил юзернейм, берём ссылку первой кнопки
  const want = bare(raw.banner?.link ?? prev?.banner?.link ?? '').toLowerCase();
  const match = [...ok].find((u) => bare(u).toLowerCase() === want);
  const link = match ? bare(match) : want ? bare(buttons[0].url) : '';
  const banner = normalizeBanner({ ...(raw.banner || {}), link }, { ...(prev?.banner || {}), ...fallbackBanner });
  return { html, buttons, banner };
}

async function emojiContext() {
  const all = await availableEmoji();
  return { emojis: all.slice(0, 80), emojiSet: all.length ? new Set(all) : null };
}

/** Новый пост по теме/тезисам/источникам. overrides.banner — то, что админ выбрал руками (приоритетнее Qwen). */
export async function generatePost({ topic, brief = '', refs = [], overrides = {} }) {
  const rt = await getRuntime();
  const material = await materialFromRefs(refs);
  const { emojis, emojiSet } = await emojiContext();
  const sys = systemPrompt({ style: await stylePrompt(), emojis, links: rt.links });
  const user = `ТЕМА: ${topic}\n${brief ? `ТЕЗИСЫ: ${brief}\n` : ''}${material ? `\nМАТЕРИАЛ ИЗ БАЗ:\n${material}\n` : ''}\nНапиши пост и данные баннера. Первая строка поста — сильный хук.`;
  const raw = await chatJSON([{ role: 'system', content: sys }, { role: 'user', content: user }]);
  const lockedBanner = Object.fromEntries(Object.entries(overrides.banner || {}).filter(([, v]) => v));
  const out = normalize(raw, { links: rt.links, material, emojiSet });
  out.banner = normalizeBanner({ ...out.banner, object: fixIcon(out.banner.object, `${topic} ${stripTags(out.html)}`) });
  out.banner = normalizeBanner({ ...out.banner, ...lockedBanner }); // ручной выбор админа перебивает Qwen и fixIcon
  return out;
}

/** Правка по инструкции админа («сделай короче», «добавь про 24 часа», «смени баннер на тёмный»). */
export async function revisePost(post, instruction, refs = post.refs || []) {
  const rt = await getRuntime();
  const material = await materialFromRefs(refs);
  const { emojis, emojiSet } = await emojiContext();
  const sys = systemPrompt({ style: await stylePrompt(), emojis, links: rt.links });
  const current = JSON.stringify({ html: post.html, banner: post.banner, buttons: post.buttons });
  const user = `ТЕКУЩИЙ ПОСТ (JSON): ${current}\n${material ? `\nМАТЕРИАЛ ИЗ БАЗ:\n${material}\n` : ''}\nПРАВКА ОТ РЕДАКТОРА: ${instruction}\n\nВнеси только запрошенные изменения, остальное сохрани. Верни полный JSON поста в том же формате.`;
  const raw = await chatJSON([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.5 });
  return normalize(raw, { links: rt.links, material, prev: post, emojiSet });
}

/** Контент-план на N дней по реальным материалам баз. */
export async function generatePlan({ days = 14, start, focus = '' }) {
  const rt = await getRuntime();
  const ctx = await overview();
  const sys = 'Ты — контент-стратег Telegram-канала. Отвечай только JSON-объектом.';
  const user = `${planPrompt({ days, start, focus, links: rt.links })}\n\nМАТЕРИАЛЫ ИЗ БАЗ:\n${ctx || '(базы не подключены — опирайся на тему канала)'}`;
  const raw = await chatJSON([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.8, maxTokens: 4500 });
  const items = (raw.items || []).filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.day) && i.topic);
  return items.slice(0, days).map((i) => ({
    day: i.day,
    topic: String(i.topic).slice(0, 200),
    brief: `${i.hook ? `Хук: ${String(i.hook).slice(0, 120)}. ` : ''}${String(i.brief || '')}`.slice(0, 900),
  }));
}

export { visibleLen };
