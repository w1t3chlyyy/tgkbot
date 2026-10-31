// Выдача поста админу: фото + текст (с типографикой и премиум-эмодзи), под ним текст кнопок «Название - Ссылка», панель правок.
import { InlineKeyboard } from 'grammy';
import { posts, getRuntime } from './store.js';
import { sendPost, buttonsText } from './tgsend.js';
import { OBJECTS, WORDS, LAYOUTS } from './prompts.js';
import { presets, fmt } from './tz.js';

export const cb = (id, act, arg) => `p:${id}:${act}${arg !== undefined ? ':' + arg : ''}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LAYOUT_NAME = { dark: 'чёрный', light: 'белый', blue: 'синий' };
const STATUS_NAME = { draft: 'черновик', scheduled: 'запланирован', published: 'опубликован', cancelled: 'убран', failed: 'ошибка', publishing: 'публикуется' };

export function controlText(post, rt, note = '') {
  const lines = [`<b>Пост #${post.id}</b> · ${STATUS_NAME[post.status] || post.status}`];
  if (post.topic) lines.push(`Тема: ${esc(post.topic).slice(0, 120)}`);
  if (post.status === 'scheduled' && post.scheduled_at) lines.push(`🗓 Выйдет: ${fmt(post.scheduled_at, rt.tz)}`);
  if (post.status === 'failed' && post.error) lines.push(`⚠️ ${esc(post.error).slice(0, 200)}`);
  if (note) lines.push(note);
  if (post.status !== 'scheduled') lines.push('\nВсё устраивает или что-то поправить?');
  return lines.join('\n');
}

export function menuKeyboard(post, menu = 'main', rt = {}) {
  const id = post.id;
  const k = new InlineKeyboard();
  const tz = rt.tz || 'Europe/Moscow';
  if (menu === 'banner') {
    const b = post.banner || {};
    return k.text(`Фон: ${LAYOUT_NAME[b.layout] || 'чёрный'} ⇄`, cb(id, 'bl')).text(`Иконка: ${b.object || 'case'} ⇄`, cb(id, 'bo')).row()
      .text('Заголовок', cb(id, 'bh')).text('Плашка', cb(id, 'bp')).row()
      .text('Ссылка', cb(id, 'bk')).text('← Назад', cb(id, 'back'));
  }
  if (menu === 'sched') {
    for (const [label, d] of presets(tz)) k.text(label, cb(id, 't', Math.floor(d.getTime() / 1000))).row();
    return k.text('✍️ Своё время', cb(id, 'tc')).text('← Назад', cb(id, 'back'));
  }
  const future = post.scheduled_at && new Date(post.scheduled_at) > new Date();
  if (post.status === 'scheduled') k.text('⏸ Снять с плана', cb(id, 'unsched')).row();
  else if (future) k.text(`✅ Одобрить на ${fmt(post.scheduled_at, tz)}`, cb(id, 'plan')).row();
  k.text('🚀 Опубликовать сейчас', cb(id, 'pub')).row();
  if (post.status !== 'scheduled') k.text('🗓 Другое время', cb(id, 'sched')).row();
  return k.text('✏️ Править текст', cb(id, 'edit')).text('🖼 Баннер', cb(id, 'banner')).row()
    .text('🔁 Другой вариант', cb(id, 'regen')).text('🗑 Убрать', cb(id, 'cancel'));
}

async function cleanup(api, chatId, preview) {
  const ids = [...(preview?.ids || []), preview?.control].filter(Boolean);
  for (const id of ids) { try { await api.deleteMessage(chatId, id); } catch { /* уже удалено */ } }
}

/** Показывает (пере-показывает) пост админу: 1) фото+текст, 2) кнопки текстом, 3) панель правок. */
export async function showDraft(api, chatId, postId, { menu = 'main', note = '' } = {}) {
  const post = await posts.get(postId);
  if (!post) throw new Error(`Пост #${postId} не найден`);
  const rt = await getRuntime();
  await cleanup(api, chatId, post.preview);

  const sent = await sendPost(api, chatId, post, { buttons: false });
  const ids = [...sent.ids];

  const bt = buttonsText(post.buttons);
  if (bt) {
    const m = await api.sendMessage(chatId, `<b>Кнопки под пост</b> (нажми на блок, чтобы скопировать):\n<pre>${esc(bt)}</pre>`, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    ids.push(m.message_id);
  }

  let fullNote = note;
  if (sent.customAsked > 0 && (sent.kept || 0) < sent.customAsked) {
    fullNote += `${fullNote ? '\n' : ''}⚠️ Telegram заменил премиум-эмодзи обычными: бот без юзернейма с Fragment не может их отправлять.`;
  }
  const ctrl = await api.sendMessage(chatId, controlText(post, rt, fullNote), { parse_mode: 'HTML', reply_markup: menuKeyboard(post, menu, rt) });
  await posts.update(postId, { admin_chat_id: chatId, preview: { ids, control: ctrl.message_id } });
  return post;
}

export const cycle = (obj, cur) => { const k = Object.keys(obj); return k[(k.indexOf(cur) + 1) % k.length]; };
export { OBJECTS, WORDS, LAYOUTS };
