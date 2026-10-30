// Контент-план: разбор присланного текста, ежедневная подготовка поста на согласование.
import { chatJSON } from './qwen.js';
import { PARSE_PLAN_SYSTEM, parsePlanUser } from './prompts.js';
import { plan, posts, getRuntime } from './store.js';
import { generatePost } from './post.js';
import { showDraft } from './draft.js';
import { nowIn, addDays } from './tz.js';

const pad = (n) => String(n).padStart(2, '0');
export const ymd = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
export const todayIn = (tz, now = new Date()) => ymd(nowIn(tz, now));
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Ответ Qwen → [{day, topic, brief}]. Терпимо к другим названиям ключей. */
function pickItems(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.items || raw?.posts || raw?.plan || raw?.result || Object.values(raw || {}).find(Array.isArray) || [];
  return arr.map((i) => ({
    day: i?.day || i?.date || null,
    topic: i?.topic || i?.title || i?.name || '',
    brief: i?.brief || i?.details || i?.description || '',
  }));
}

/** Запасной разбор без нейросети: строки вида «30.10 Тема. Хук: … Тезисы: …». Строки без даты дописываются к предыдущему пункту. */
export function parseDated(text, tz, now = new Date()) {
  const n = nowIn(tz, now);
  const todayMs = Date.UTC(n.y, n.m - 1, n.d);
  const re = /^\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*(?:[—–:-]\s*)?(\S.*)$/;
  const raw = [];
  for (const line of String(text).split('\n')) {
    const m = line.match(re);
    const d = m && +m[1], mo = m && +m[2];
    if (m && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      let y = m[3] ? +m[3] : n.y;
      if (y < 100) y += 2000;
      if (!m[3] && Date.UTC(y, mo - 1, d) < todayMs - 180 * 86400_000) y += 1; // «05.01» в декабре — это следующий год
      raw.push({ day: `${y}-${pad(mo)}-${pad(d)}`, text: m[4].trim() });
    } else if (raw.length && line.trim()) raw.at(-1).text += ' ' + line.trim();
  }
  return raw.map(({ day, text: t }) => {
    const topic = t.split(/\.\s|\s+Хук:|\s+Тезисы:/)[0].replace(/[.\s]+$/, '').slice(0, 120);
    return { day, topic, brief: t.slice(topic.length).replace(/^[.\s]+/, '') };
  }).filter((i) => i.topic);
}

/** Текст плана → [{day, topic, brief}] (даты проставлены; пункты без дат идут подряд по дням). */
export async function parsePlan(text, { tz, now = new Date(), dailyTime = '10:00' }) {
  const today = todayIn(tz, now);
  let items = [];
  try {
    const raw = await chatJSON(
      [{ role: 'system', content: PARSE_PLAN_SYSTEM }, { role: 'user', content: parsePlanUser({ text: text.slice(0, 20000), today, tz }) }],
      { temperature: 0.1, maxTokens: 8000 },
    );
    items = pickItems(raw).filter((i) => i.topic && String(i.topic).trim());
  } catch (e) { console.error('[plan parse]', e.message); }
  if (!items.length) items = parseDated(text, tz, now); // Qwen промолчал или вернул не то: разбираем сами по датам в начале строк
  items = items.slice(0, 62);
  if (!items.length) throw new Error('Не нашёл в тексте ни одного поста. Пришли план списком: по строке или абзацу на пост, в начале строки дата (30.10) или номер.');

  // если сегодняшнее время публикации уже прошло — безбумажные пункты начинаем с завтра
  const n = nowIn(tz, now);
  const afterToday = n.h * 60 + n.mi >= minutesOf(dailyTime);
  let cursor = parseYmd(afterToday ? ymd(addDays(n.y, n.m, n.d, 1)) : today);
  const out = [];
  let skippedPast = 0;
  for (const it of items) {
    let day = /^\d{4}-\d{2}-\d{2}$/.test(it.day || '') ? it.day : null;
    if (day) cursor = parseYmd(day); else day = ymd(cursor);
    cursor = addDays(cursor.y, cursor.m, cursor.d, 1);
    if (day < today) { skippedPast++; continue; }
    out.push({ day, topic: String(it.topic).trim().slice(0, 200), brief: String(it.brief || '').trim().slice(0, 1500) });
  }
  return { items: out, skippedPast };
}

export async function savePlan(items) {
  await plan.clearOpen([...new Set(items.map((i) => i.day))]);
  return plan.insertMany(items.map((i) => ({ day: i.day, topic: i.topic, brief: i.brief })));
}

/** Делает пост из пункта плана и присылает его на согласование. Пункт уже «забран» (status=making). */
export async function makeFromItem(api, item, { note = '📅 Пост по плану на сегодня' } = {}) {
  const rt = await getRuntime();
  try {
    const gen = await generatePost({ topic: item.topic, brief: item.brief, refs: item.refs || [] });
    const post = await posts.create({ status: 'draft', topic: item.topic, brief: item.brief, refs: item.refs || [], html: gen.html, banner: gen.banner, buttons: gen.buttons, admin_chat_id: rt.approver });
    await plan.update(item.id, { status: 'made', post_id: post.id });
    await showDraft(api, rt.approver, post.id, { note });
    return post;
  } catch (e) {
    await plan.update(item.id, { status: 'failed' }).catch(() => {});
    await api.sendMessage(rt.approver, `⚠️ Не получилось подготовить пост «${item.topic}»: ${e.message}\nПовтор: /today`).catch(() => {});
    throw e;
  }
}

/** Ежеминутная проверка: пришло ли время ежедневного поста и есть ли пункт плана на сегодня. */
export async function dailyTick(api, { now = new Date(), defer = (p) => p } = {}) {
  const rt = await getRuntime();
  if (!rt.dailyEnabled) return { started: false, reason: 'off' };
  const n = nowIn(rt.tz, now);
  if (n.h * 60 + n.mi < minutesOf(rt.dailyTime)) return { started: false, reason: 'early' };
  const [item] = await plan.forDay(ymd(n), ['idea']);
  if (!item) return { started: false, reason: 'no-item' };
  const claimed = await plan.claim(item.id, ['idea']);
  if (!claimed) return { started: false, reason: 'claimed' };
  defer(makeFromItem(api, claimed).catch((e) => console.error('[daily]', e.message)));
  return { started: true, item: claimed.id };
}

/** Ручной запуск (/today): пункт на сегодня в статусах idea/failed. */
export async function makeToday(api, { now = new Date() } = {}) {
  const rt = await getRuntime();
  const [item] = await plan.forDay(todayIn(rt.tz, now), ['idea', 'failed']);
  if (!item) return null;
  const claimed = await plan.claim(item.id, ['idea', 'failed']);
  if (!claimed) return null;
  return makeFromItem(api, claimed);
}
