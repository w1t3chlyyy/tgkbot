// Юзернеймы бота: у каждого слова заглавная буква (@HustlifySaleRobot), регистр в ссылках Telegram не важен.
const KNOWN = ['HustlifyBot', 'HustlifyCasesBot', 'HustlifySaleRobot', 'HustlifyHelp'];
const PARTS = /(hustlify|robot|sales|sale|cases|case|support|help|shop|video|team|work|bot|site)/gi;

export function canonHandle(h) {
  const s = String(h).replace(/^@/, '');
  const hit = KNOWN.find((k) => k.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  const out = s.toLowerCase().replace(PARTS, (w) => w[0].toUpperCase() + w.slice(1));
  return out[0].toUpperCase() + out.slice(1);
}

/** «t.me/hustlifysalerobot» → «@HustlifySaleRobot»; остальные ссылки без изменений. */
export function displayLink(link) {
  const m = String(link || '').match(/^(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]{4,32})\/?$/i);
  return m ? '@' + canonHandle(m[1]) : String(link || '');
}

/** В видимом тексте поста (не внутри тегов и ссылок) приводит @hustlify… к виду @HustlifySaleRobot. */
export function fixHandles(html) {
  return html.split(/(<[^>]+>)/).map((p) => (p.startsWith('<') ? p : p.replace(/@(hustlify[A-Za-z0-9_]*)/gi, (_, h) => '@' + canonHandle(h)))).join('');
}
