// Выдача поста админу: фото + текст (с типографикой и премиум-эмодзи), под ним текст кнопок «Название - Ссылка», панель правок.
import { InlineKeyboard } from 'grammy';
import { posts, getRuntime } from './store.js';
import { sendPost, buttonsText } from './tgsend.js';
import { OBJECTS, WORDS, LAYOUTS } from './prompts.js';

export const cb = (id, act, arg) => `p:${id}:${act}${arg !== undefined ? ':' + arg : ''}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LAYOUT_NAME = { dark: 'чёрный', light: 'белый', blue: 'синий' };

export function controlText(post, rt, note = '') {
  const lines = [`<b>Пост #${post.id}</b> · ${{ draft: 'черновик', scheduled: 'запланирован', published: 'опубликован', cancelled: 'убран' }[post.status] || post.status}`];
  if (post.topic) lines.push(`Тема: ${esc(post.topic).slice(0, 120)}`);
  if (note) lines.push(note);
  if (post.status !== 'scheduled') lines.push('\nВсё устраивает или что-то поправить?');
  return lines.join('\n');
}

export function menuKeyboard(post, menu) {
  const id = post.id;
  const k = new InlineKeyboard();
  if (menu === 'banner') {
    const b = post.banner || {};
    return k.text(`Фон: ${LAYOUT_NAME[b.layout] || 'чёрный'} ⇄`, cb(id, 'bl')).text(`Иконка: ${b.object} ⇄`, cb(id, 'bo')).row()
      .text('Заголовок', cb(id, 'bh')).text('Плашка', cb(id, 'bp')).row()
      .text('Ссылка', cb(id, 'bk')).text('← Назад', cb(id, 'back'));
  }
  return k.text('🚀 Опубликовать сейчас', cb(id, 'pub')).row()
    .text('✏️ Править текст', cb(id, 'edit')).text('🖼 Баннер', cb(id, 'banner')).row()
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
  const ctrl = await api.sendMessage(chatId, controlText(post, rt, fullNote), { parse_mode: 'HTML', reply_markup: menuKeyboard(post, menu) });
  await posts.update(postId, { admin_chat_id: chatId, preview: { ids, control: ctrl.message_id } });
  return post;
}

export const cycle = (obj, cur) => { const k = Object.keys(obj); return k[(k.indexOf(cur) + 1) % k.length]; };
export { OBJECTS, WORDS, LAYOUTS };
