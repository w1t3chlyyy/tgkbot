// Санитайзер Telegram-HTML, подстановка премиум-эмодзи.
import { loadEmojiMap } from './store.js';

const SIMPLE = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'tg-spoiler']);

export function sanitizeHtml(input) {
  let src = String(input || '').replace(/\r/g, '');
  // Qwen иногда отвечает markdown-ом: **жирный**, # заголовок, «- пункт». В Telegram-HTML это превращается в «звёздочки» в тексте.
  src = src
    .replace(/\*\*([^\n]+?)\*\*/g, '<b>$1</b>')
    .replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, '<b>$1</b>')
    .replace(/^[ \t]*[-*][ \t]+/gm, '• ');
  src = src.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<\/?p[^>]*>/gi, '\n');
  src = src.replace(/<(\/?)h[1-6][^>]*>/gi, (_, c) => (c ? '</b>\n' : '<b>')).replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n').replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  const out = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  let last = 0, m;
  const esc = (t) => t.replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  while ((m = re.exec(src))) {
    out.push(esc(src.slice(last, m.index)));
    last = re.lastIndex;
    const closing = !!m[1], tag = m[2].toLowerCase(), attrs = m[3];
    if (closing) {
      const i = stack.lastIndexOf(tag);
      if (i >= 0) { while (stack.length > i) out.push(`</${stack.pop()}>`); }
      continue;
    }
    if (SIMPLE.has(tag)) { stack.push(tag); out.push(`<${tag}>`); }
    else if (tag === 'a') {
      const href = attrs.match(/href\s*=\s*"([^"]+)"/i)?.[1] || attrs.match(/href\s*=\s*'([^']+)'/i)?.[1];
      if (href && /^(https?:\/\/|tg:\/\/)/i.test(href)) { stack.push('a'); out.push(`<a href="${href.replace(/"/g, '&quot;')}">`); }
    } else if (tag === 'tg-emoji') {
      const id = attrs.match(/emoji-id\s*=\s*"(\d+)"/i)?.[1];
      if (id) { stack.push('tg-emoji'); out.push(`<tg-emoji emoji-id="${id}">`); }
    } else if (tag === 'blockquote') {
      stack.push('blockquote'); out.push(/expandable/i.test(attrs) ? '<blockquote expandable>' : '<blockquote>');
    }
    // остальные теги отбрасываем, текст внутри остаётся
  }
  out.push(esc(src.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export const stripTags = (html) =>
  html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
export const visibleLen = (html) => [...stripTags(html)].length;

const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u20E3|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;

/** Убирает из текста эмодзи, которых нет в паке (allowed — Set «базовых» эмодзи без FE0F). Qwen часто игнорирует список в промпте. */
export function restrictEmoji(html, allowed) {
  if (!allowed || !allowed.size) return html;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) return part;
    return part.replace(EMOJI_RE, (e) => (allowed.has(e.replace(/\uFE0F/g, '')) ? e : ''));
  }).join('').replace(/[ \t]+$/gm, '').replace(/^[ \t]+/gm, '').replace(/([^\n ]) {2,}/g, '$1 ');
}

/** Заменяет обычные эмодзи в тексте на премиум-эмодзи из загруженного пака (по совпадению базового эмодзи). */
export async function applyCustomEmoji(html) {
  const map = await loadEmojiMap();
  if (!map.size) return html;
  let inEmoji = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<tg-emoji/i.test(part)) inEmoji++;
      else if (/^<\/tg-emoji/i.test(part)) inEmoji = Math.max(0, inEmoji - 1);
      return part;
    }
    if (inEmoji) return part;
    return part.replace(EMOJI_RE, (e) => {
      const id = map.get(e.replace(/\uFE0F/g, ''));
      return id ? `<tg-emoji emoji-id="${id}">${e}</tg-emoji>` : e;
    });
  }).join('');
}

export async function availableEmoji() {
  const map = await loadEmojiMap();
  return [...map.keys()];
}
