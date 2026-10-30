import { InputFile } from 'grammy';
import { renderBanner } from './banner.js';
import { applyCustomEmoji, stripTags, visibleLen } from './html.js';
import { getRuntime } from './store.js';

const validUrl = (b) => /^(https?:\/\/|tg:\/\/)/i.test(b?.url || '');

export function keyboardOf(buttons = []) {
  const rows = buttons.filter(validUrl).map((b) => [{ text: b.text, url: b.url }]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

/** Кнопки поста в виде текста «Название - Ссылка», по строке на кнопку (для ручного создания поста в другом канале). */
export const buttonsText = (buttons = []) => buttons.filter(validUrl).map((b) => `${b.text} - ${b.url}`).join('\n');

const CAPTION_LIMIT = 1024;
const countCustom = (m) => (m?.caption_entities || m?.entities || []).filter((e) => e.type === 'custom_emoji').length;

async function trySend(api, chatId, post, html, { buttons = true } = {}) {
  const png = renderBanner(post.banner);
  const reply_markup = buttons ? keyboardOf(post.buttons) : undefined;
  if (visibleLen(html) <= CAPTION_LIMIT) {
    const m = await api.sendPhoto(chatId, new InputFile(png, 'banner.png'), { caption: html, parse_mode: 'HTML', reply_markup });
    return { ids: [m.message_id], chat: m.chat, kept: countCustom(m) };
  }
  const m1 = await api.sendPhoto(chatId, new InputFile(png, 'banner.png'));
  const m2 = await api.sendMessage(chatId, html, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup });
  return { ids: [m1.message_id, m2.message_id], chat: m2.chat, kept: countCustom(m2) };
}

/**
 * Отправляет пост (баннер + текст [+ кнопки]) в чат/канал.
 * buttons: false — без inline-кнопок (кнопки отдельно текстом).
 * Возвращает customAsked (сколько премиум-эмодзи отправили) и kept (сколько Telegram реально оставил в сообщении):
 * если kept < customAsked, Telegram подменил их обычными (боты без юзернейма с Fragment не могут их отправлять).
 */
export async function sendPost(api, chatId, post, { custom, buttons = true } = {}) {
  const rt = await getRuntime();
  const useCustom = custom ?? rt.customEmoji;
  if (useCustom) {
    try {
      const html = await applyCustomEmoji(post.html);
      const customAsked = (html.match(/<tg-emoji/g) || []).length;
      return { ...(await trySend(api, chatId, post, html, { buttons })), customUsed: true, customAsked };
    } catch (e) {
      if (!/emoji|entit|DOCUMENT_INVALID|can't parse/i.test(e.message || e.description || '')) throw e;
      console.warn('[send] премиум-эмодзи не приняты, отправляю обычными:', e.message);
    }
  }
  try { return { ...(await trySend(api, chatId, post, post.html, { buttons })), customUsed: false, customAsked: 0, kept: 0 }; }
  catch (e) {
    if (!/can't parse entities/i.test(e.message || '')) throw e;
    const plain = stripTags(post.html).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { ...(await trySend(api, chatId, post, plain, { buttons })), customUsed: false, customAsked: 0, kept: 0 }; // последний шанс: без разметки
  }
}

export function postLink(chat, ids) {
  const id = ids[ids.length - 1];
  if (chat?.username) return `https://t.me/${chat.username}/${id}`;
  if (chat?.id && String(chat.id).startsWith('-100')) return `https://t.me/c/${String(chat.id).slice(4)}/${id}`;
  return null;
}
