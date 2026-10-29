import { InputFile } from 'grammy';
import { renderBanner } from './banner.js';
import { applyCustomEmoji, stripTags, visibleLen } from './html.js';
import { getRuntime } from './store.js';

export function keyboardOf(buttons = []) {
  const rows = buttons.filter((b) => /^(https?:\/\/|tg:\/\/)/i.test(b.url)).map((b) => [{ text: b.text, url: b.url }]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

const CAPTION_LIMIT = 1024;

async function trySend(api, chatId, post, html) {
  const png = renderBanner(post.banner);
  const reply_markup = keyboardOf(post.buttons);
  if (visibleLen(html) <= CAPTION_LIMIT) {
    const m = await api.sendPhoto(chatId, new InputFile(png, 'banner.png'), { caption: html, parse_mode: 'HTML', reply_markup });
    return { ids: [m.message_id], chat: m.chat };
  }
  const m1 = await api.sendPhoto(chatId, new InputFile(png, 'banner.png'));
  const m2 = await api.sendMessage(chatId, html, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup });
  return { ids: [m1.message_id, m2.message_id], chat: m2.chat };
}

/** Отправляет пост (баннер + текст + кнопки) в чат/канал. Если премиум-эмодзи не принимаются — отправляет с обычными. */
export async function sendPost(api, chatId, post, { custom } = {}) {
  const rt = await getRuntime();
  const useCustom = custom ?? rt.customEmoji;
  if (useCustom) {
    try { return { ...(await trySend(api, chatId, post, await applyCustomEmoji(post.html))), customUsed: true }; }
    catch (e) {
      if (!/emoji|entit|DOCUMENT_INVALID|can't parse/i.test(e.message || e.description || '')) throw e;
      console.warn('[send] премиум-эмодзи не приняты, отправляю обычными:', e.message);
    }
  }
  try { return { ...(await trySend(api, chatId, post, post.html)), customUsed: false }; }
  catch (e) {
    if (!/can't parse entities/i.test(e.message || '')) throw e;
    const plain = stripTags(post.html).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { ...(await trySend(api, chatId, post, plain)), customUsed: false }; // последний шанс: без разметки
  }
}

export function postLink(chat, ids) {
  const id = ids[ids.length - 1];
  if (chat?.username) return `https://t.me/${chat.username}/${id}`;
  if (chat?.id && String(chat.id).startsWith('-100')) return `https://t.me/c/${String(chat.id).slice(4)}/${id}`;
  return null;
}
