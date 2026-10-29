// Карточка согласования: превью поста (точная копия того, что уйдёт в канал) + панель «Всё устраивает?»
import { InlineKeyboard } from 'grammy';
import { posts, getRuntime } from './store.js';
import { sendPost } from './tgsend.js';
import { presets, fmt } from './tz.js';
import { OBJECTS, WORDS } from './prompts.js';

export const cb = (id, act, arg) => `p:${id}:${act}${arg !== undefined ? ':' + arg : ''}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function controlText(post, rt, note = '') {
  const lines = [`<b>Пост #${post.id}</b> · ${{ draft: 'черновик', scheduled: 'запланирован', published: 'опубликован', cancelled: 'отменён' }[post.status] || post.status}`];
  if (post.topic) lines.push(`Тема: ${esc(post.topic).slice(0, 120)}`);
  if (post.scheduled_at) lines.push(`🕐 ${post.status === 'scheduled' ? 'Выйдет' : 'По плану'}: <b>${fmt(post.scheduled_at, rt.tz)}</b>`);
  if (note) lines.push(note);
  if (post.status !== 'scheduled') lines.push('\nВсё устраивает или что-то поправить?');
  return lines.join('\n');
}

export function menuKeyboard(post, menu, rt) {
  const id = post.id;
  const k = new InlineKeyboard();
  if (post.status === 'scheduled') {
    return k.text('🚀 Опубликовать сейчас', cb(id, 'pub')).row()
      .text('🕐 Изменить время', cb(id, 'sched')).text('↩️ Снять с плана', cb(id, 'unsched')).row()
      .text('✏️ Править', cb(id, 'edit')).text('🖼 Баннер', cb(id, 'banner'));
  }
  if (menu === 'banner') {
    const b = post.banner || {};
    return k.text(`Макет: ${b.layout === 'dark' ? 'тёмный' : 'светлый'} ⇄`, cb(id, 'bl')).text(`Объект: ${b.object} ⇄`, cb(id, 'bo')).row()
      .text(`Надпись: ${b.word} ⇄`, cb(id, 'bw')).text('Заголовок', cb(id, 'bh')).row()
      .text('Плашка', cb(id, 'bp')).text('Ссылка', cb(id, 'bk')).row()
      .text('← Назад', cb(id, 'back'));
  }
  if (menu === 'sched') {
    for (const [label, d] of presets(rt.tz)) k.text(label, cb(id, 't', Math.floor(d.getTime() / 1000))).row();
    return k.text('✍️ Своё время', cb(id, 'tc')).text('← Назад', cb(id, 'back'));
  }
  if (post.scheduled_at && new Date(post.scheduled_at) > new Date()) {
    k.text(`✅ Одобрить на ${fmt(post.scheduled_at, rt.tz)}`, cb(id, 'plan')).row();
  }
  return k.text('🚀 Опубликовать сейчас', cb(id, 'pub')).text('🕐 Другое время', cb(id, 'sched')).row()
    .text('✏️ Править текст', cb(id, 'edit')).text('🖼 Баннер', cb(id, 'banner')).row()
    .text('🔁 Другой вариант', cb(id, 'regen')).text('🗑 Отмена', cb(id, 'cancel'));
}

async function cleanup(api, chatId, preview) {
  const ids = [...(preview?.ids || []), preview?.control].filter(Boolean);
  for (const id of ids) { try { await api.deleteMessage(chatId, id); } catch { /* уже удалено */ } }
}

/** Показывает (пере-показывает) черновик админу в чате. */
export async function showDraft(api, chatId, postId, { menu = 'main', note = '' } = {}) {
  const post = await posts.get(postId);
  if (!post) throw new Error(`Пост #${postId} не найден`);
  const rt = await getRuntime();
  await cleanup(api, chatId, post.preview);
  const sent = await sendPost(api, chatId, post);
  const ctrl = await api.sendMessage(chatId, controlText(post, rt, note), { parse_mode: 'HTML', reply_markup: menuKeyboard(post, menu, rt) });
  await posts.update(postId, { admin_chat_id: chatId, preview: { ids: sent.ids, control: ctrl.message_id } });
  return post;
}

export const cycle = (obj, cur) => { const k = Object.keys(obj); return k[(k.indexOf(cur) + 1) % k.length]; };
export { OBJECTS, WORDS };
