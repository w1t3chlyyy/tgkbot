import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ROOT } from './config.js';
import { OBJECTS, STYLES, WORDS } from './prompts.js';

const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONT_DIR, f));
// Если положить Inter-Bold.ttf / Inter-SemiBold.ttf в assets/fonts, он подхватится сам; иначе работает Montserrat.
const FONT = 'Inter, Montserrat';

const BLACK = '#0b0b0f';
const BLUE = '#2447e6';

// layout "light" = фирменный синий фон (основной), "dark" = тёмный с синим свечением.
// Акцент на синем фоне чёрный; на тёмном фоне чёрный не виден, поэтому там акцент синий.
const TONES = {
  light: { pal: { ink: '#ffffff', acc: BLACK, bg: '#dbe3ff' }, tag: { fill: BLACK, color: '#ffffff' }, num: BLACK, glass: [0.38, 0.14, 0.55] },
  dark: { pal: { ink: '#ffffff', acc: '#2f56ff', bg: BLACK }, tag: { fill: BLUE, color: '#ffffff' }, num: BLUE, glass: [0.2, 0.07, 0.4] },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function normalizeBanner(b = {}, fallback = {}) {
  const x = { layout: 'light', object: 'case', word: 'hustlify', headline: '', pill: '', link: '', style: '', points: [], ...fallback, ...b };
  if (!['light', 'dark'].includes(x.layout)) x.layout = 'light';
  if (!OBJECTS[x.object]) x.object = 'case';
  if (!WORDS[x.word]) x.word = 'hustlify';
  if (!STYLES[x.style]) x.style = '';
  x.points = (Array.isArray(x.points) ? x.points : []).map((p) => String(p ?? '').trim().slice(0, 34)).filter(Boolean).slice(0, 3);
  x.headline = String(x.headline || '').trim().slice(0, 60);
  x.pill = String(x.pill || '').trim().slice(0, 30);
  x.link = String(x.link || '').trim().replace(/^https?:\/\//, '').slice(0, 40);
  return x;
}

/* ── логотип: assets/logo.svg или assets/logo.png (белая версия, под синий и тёмный фон) ── */
let logoCache;
function logoInfo() {
  if (logoCache !== undefined) return logoCache;
  logoCache = null;
  for (const name of ['logo.svg', 'logo.png']) {
    const file = path.join(ROOT, 'assets', name);
    if (!fs.existsSync(file)) continue;
    try {
      const buf = fs.readFileSync(file);
      let w, h, mime;
      if (name.endsWith('.png')) { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); mime = 'image/png'; }
      else {
        const s = buf.toString('utf8');
        const vb = s.match(/viewBox\s*=\s*"([^"]+)"/i);
        if (vb) { const n = vb[1].trim().split(/[\s,]+/).map(Number); w = n[2]; h = n[3]; }
        else { w = parseFloat(s.match(/<svg[^>]*\swidth\s*=\s*"([\d.]+)/i)?.[1]); h = parseFloat(s.match(/<svg[^>]*\sheight\s*=\s*"([\d.]+)/i)?.[1]); }
        mime = 'image/svg+xml';
      }
      if (w > 0 && h > 0) { logoCache = { href: `data:${mime};base64,${buf.toString('base64')}`, ratio: w / h }; break; }
    } catch (e) { console.warn('[logo]', e.message); }
  }
  return logoCache;
}
function logo() {
  const l = logoInfo();
  if (!l) {
    return `<text x="96" y="104" font-family="${FONT}" font-size="36" fill="#fff" letter-spacing="1"><tspan font-weight="700">HUSTLI</tspan><tspan font-weight="400">FY</tspan></text>`;
  }
  let h = l.ratio < 1.5 ? 68 : 52, w = h * l.ratio; // квадратный знак крупнее, широкий логотип ниже
  if (w > 340) { w = 340; h = w / l.ratio; }
  return `<image xlink:href="${l.href}" x="96" y="${Math.round(82 - h / 2)}" width="${Math.round(w)}" height="${Math.round(h)}"/>`;
}

/** Переносит заголовок на строки: уважает \n, иначе делит по пробелу ближе к середине. */
export function wrapHeadline(text, maxChars = 18) {
  let lines = text.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && [...lines[0]].length > maxChars) {
    const w = lines[0].split(/\s+/);
    let best = 1, diff = 1e9;
    for (let i = 1; i < w.length; i++) {
      const d = Math.abs([...w.slice(0, i).join(' ')].length - [...w.slice(i).join(' ')].length);
      if (d < diff) { diff = d; best = i; }
    }
    while (best > 1 && [...w[best - 1]].length <= 2) best--; // предлоги и союзы не оставляем в конце строки
    lines = w.length > 1 ? [w.slice(0, best).join(' '), w.slice(best).join(' ')] : lines;
  }
  return lines.slice(0, 3);
}
const fit = (lines, maxW, maxSize, k = 0.64) => Math.max(34, Math.min(maxSize, Math.floor(maxW / (Math.max(...lines.map((l) => [...l].length)) * k))));

/* ── иконки: квадрат 200×200, палитра p = {ink, acc, bg} ── */
const starPts = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r : R;
  return `${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`;
}).join(' ');

const DRAW = {
  gift: (p) => `<rect x="26" y="70" width="148" height="40" rx="10" fill="${p.ink}"/><rect x="38" y="110" width="124" height="74" rx="10" fill="${p.acc}"/><rect x="90" y="70" width="20" height="114" fill="${p.bg}"/><ellipse cx="70" cy="52" rx="30" ry="18" transform="rotate(-24 70 52)" fill="${p.ink}"/><ellipse cx="130" cy="52" rx="30" ry="18" transform="rotate(24 130 52)" fill="${p.ink}"/><circle cx="100" cy="62" r="12" fill="${p.acc}"/>`,
  gem: (p) => `<path d="M58 40 H142 L184 92 L100 178 L16 92 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/><path d="M16 92 H184 M58 40 L78 92 L100 178 M142 40 L122 92 L100 178" fill="none" stroke="${p.bg}" stroke-width="7" stroke-linejoin="round"/><path d="M78 92 L100 40 L122 92" fill="none" stroke="${p.acc}" stroke-width="9" stroke-linejoin="round"/>`,
  bolt: (p) => `<circle cx="100" cy="100" r="92" fill="none" stroke="${p.acc}" stroke-width="8" stroke-dasharray="2 18" stroke-linecap="round"/><path d="M118 22 L46 112 H92 L80 180 L158 82 H110 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/>`,
  chat: (p) => `<rect x="16" y="30" width="168" height="112" rx="30" fill="${p.ink}"/><path d="M58 136 L46 184 L100 140 Z" fill="${p.ink}"/><circle cx="62" cy="86" r="12" fill="${p.acc}"/><circle cx="100" cy="86" r="12" fill="${p.acc}"/><circle cx="138" cy="86" r="12" fill="${p.acc}"/>`,
  case: (p) => `<path d="M74 66 V50 a12 12 0 0 1 12 -12 H114 a12 12 0 0 1 12 12 V66" fill="none" stroke="${p.ink}" stroke-width="12" stroke-linecap="round"/><rect x="18" y="64" width="164" height="112" rx="18" fill="${p.ink}"/><rect x="18" y="108" width="164" height="14" fill="${p.acc}"/><rect x="87" y="98" width="26" height="34" rx="7" fill="${p.bg}" stroke="${p.acc}" stroke-width="6"/>`,
  rocket: (p) => `<path d="M64 124 L28 162 L68 152 Z" fill="${p.acc}"/><path d="M136 124 L172 162 L132 152 Z" fill="${p.acc}"/><path d="M100 12 C142 44 152 100 138 146 H62 C48 100 58 44 100 12 Z" fill="${p.ink}"/><circle cx="100" cy="76" r="17" fill="${p.acc}"/><circle cx="100" cy="76" r="8" fill="${p.bg}"/><path d="M80 154 Q100 200 120 154 Z" fill="${p.acc}"/>`,
  note: (p) => `<rect x="78" y="42" width="14" height="108" fill="${p.ink}"/><rect x="156" y="24" width="14" height="108" fill="${p.ink}"/><circle cx="62" cy="150" r="28" fill="${p.ink}"/><circle cx="140" cy="132" r="28" fill="${p.ink}"/><path d="M78 42 L170 24 V60 L78 78 Z" fill="${p.acc}"/>`,
  heart: (p) => `<path d="M100 178 C22 122 8 72 44 48 C70 32 92 44 100 64 C108 44 130 32 156 48 C192 72 178 122 100 178 Z" fill="${p.ink}"/><path d="M52 70 C58 60 70 58 78 64" fill="none" stroke="${p.acc}" stroke-width="10" stroke-linecap="round"/>`,
  shield: (p) => `<path d="M100 14 L170 42 V96 C170 140 140 168 100 188 C60 168 30 140 30 96 V42 Z" fill="${p.ink}"/><path d="M66 100 L90 124 L136 74" fill="none" stroke="${p.acc}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
  chart: (p) => `<rect x="22" y="120" width="34" height="56" rx="8" fill="${p.ink}"/><rect x="68" y="92" width="34" height="84" rx="8" fill="${p.ink}"/><rect x="114" y="62" width="34" height="114" rx="8" fill="${p.ink}"/><path d="M24 78 L76 46 L104 62 L158 26" fill="none" stroke="${p.acc}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M168 14 L184 56 L140 40 Z" fill="${p.acc}"/>`,
  trophy: (p) => `<path d="M54 28 H146 V92 C146 124 126 142 100 142 C74 142 54 124 54 92 Z" fill="${p.ink}"/><path d="M54 44 H28 C28 84 42 100 64 104" fill="none" stroke="${p.ink}" stroke-width="10" stroke-linecap="round"/><path d="M146 44 H172 C172 84 158 100 136 104" fill="none" stroke="${p.ink}" stroke-width="10" stroke-linecap="round"/><rect x="90" y="140" width="20" height="26" fill="${p.ink}"/><rect x="60" y="164" width="80" height="20" rx="8" fill="${p.acc}"/><circle cx="100" cy="78" r="16" fill="${p.acc}"/>`,
  bear: (p) => `<circle cx="50" cy="54" r="26" fill="${p.ink}"/><circle cx="150" cy="54" r="26" fill="${p.ink}"/><circle cx="50" cy="54" r="12" fill="${p.acc}"/><circle cx="150" cy="54" r="12" fill="${p.acc}"/><circle cx="100" cy="106" r="66" fill="${p.ink}"/><ellipse cx="100" cy="128" rx="30" ry="23" fill="${p.acc}"/><ellipse cx="100" cy="118" rx="10" ry="7" fill="${p.ink}"/><path d="M100 125 V136 M88 143 Q100 151 112 143" fill="none" stroke="${p.ink}" stroke-width="5" stroke-linecap="round"/><circle cx="76" cy="94" r="8" fill="${BLACK}"/><circle cx="124" cy="94" r="8" fill="${BLACK}"/>`,
  check: (p) => `<circle cx="100" cy="100" r="84" fill="${p.ink}"/><path d="M60 102 L88 130 L142 70" fill="none" stroke="${p.acc}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`,
  tag: (p) => `<path d="M30 30 H110 L178 98 Q186 106 178 114 L114 178 Q106 186 98 178 L30 110 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/><circle cx="66" cy="66" r="12" fill="${p.bg}"/><text x="112" y="124" font-family="${FONT}" font-weight="700" font-size="64" text-anchor="middle" fill="${p.acc}">%</text>`,
  app: (p) => `<rect x="56" y="12" width="88" height="176" rx="20" fill="${p.ink}"/><rect x="66" y="34" width="68" height="118" rx="8" fill="${p.acc}"/><rect x="88" y="19" width="24" height="5" rx="2.5" fill="${p.bg}"/><circle cx="100" cy="170" r="7" fill="${p.bg}"/><rect x="76" y="50" width="48" height="10" rx="5" fill="${p.ink}"/><rect x="76" y="70" width="34" height="10" rx="5" fill="${p.ink}" opacity=".7"/>`,
  team: (p) => `<circle cx="72" cy="66" r="28" fill="${p.ink}"/><path d="M20 172 C20 120 124 120 124 172 Z" fill="${p.ink}"/><circle cx="140" cy="78" r="23" fill="${p.acc}"/><path d="M106 174 C106 134 184 134 184 174 Z" fill="${p.acc}"/>`,
  star: (p) => `<polygon points="${starPts(100, 106, 88, 40)}" fill="${p.ink}" stroke="${p.ink}" stroke-width="14" stroke-linejoin="round"/>`,
  crown: (p) => `<path d="M22 150 L14 62 L62 102 L100 42 L138 102 L186 62 L178 150 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="8" stroke-linejoin="round"/><rect x="24" y="158" width="152" height="24" rx="9" fill="${p.acc}"/><circle cx="14" cy="60" r="12" fill="${p.ink}"/><circle cx="100" cy="38" r="12" fill="${p.ink}"/><circle cx="186" cy="60" r="12" fill="${p.ink}"/><circle cx="100" cy="122" r="13" fill="${p.acc}"/>`,
  globe: (p) => `<circle cx="100" cy="100" r="84" fill="none" stroke="${p.ink}" stroke-width="16"/><ellipse cx="100" cy="100" rx="38" ry="84" fill="none" stroke="${p.ink}" stroke-width="14"/><path d="M16 100 H184 M30 58 H170 M30 142 H170" fill="none" stroke="${p.ink}" stroke-width="12"/>`,
};

/** Иконка по центру (cx, cy) в квадрате size×size; большие размеры обрезаются краем кадра — так и задумано. */
function visual(b, cx, cy, size, pal, opacity = 1) {
  const draw = DRAW[b.object] || DRAW.case;
  return `<g transform="translate(${Math.round(cx - size / 2)} ${Math.round(cy - size / 2)}) scale(${(size / 200).toFixed(4)})"${opacity < 1 ? ` opacity="${opacity}"` : ''}>${draw(pal)}</g>`;
}

/* ── общие элементы ── */
function backdrop(tone) {
  const t = TONES[tone];
  const glass = `<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${t.glass[0]}"/><stop offset="1" stop-color="#fff" stop-opacity="${t.glass[1]}"/></linearGradient>`;
  if (tone === 'dark') {
    return `<defs>${glass}<radialGradient id="g1" cx=".82" cy=".9" r=".75"><stop offset="0" stop-color="#2f56ff" stop-opacity=".95"/><stop offset=".55" stop-color="#1a2fd0" stop-opacity=".35"/><stop offset="1" stop-color="#1a2fd0" stop-opacity="0"/></radialGradient><radialGradient id="g2" cx=".05" cy=".05" r=".5"><stop offset="0" stop-color="#2447e6" stop-opacity=".35"/><stop offset="1" stop-color="#2447e6" stop-opacity="0"/></radialGradient></defs><rect width="1500" height="1000" fill="#07080c"/><rect width="1500" height="1000" fill="url(#g1)"/><rect width="1500" height="1000" fill="url(#g2)"/>`;
  }
  return `<defs>${glass}<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6f90ff"/><stop offset="1" stop-color="#1a2fd0"/></linearGradient><radialGradient id="glow" cx=".15" cy=".05" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="1500" height="1000" fill="url(#bg)"/><rect width="1500" height="1000" fill="url(#glow)"/>`;
}

const halo = (cx, cy, radii, tone) => radii.map((r) => (tone === 'dark'
  ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`
  : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" fill-opacity=".07"/>`)).join('');

/** Маленькая полупрозрачная копия главной иконки в круге (спутник). */
const satellite = (b, cx, cy, r, t, tone) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" fill-opacity="${tone === 'dark' ? 0.08 : 0.15}"/>${visual(b, cx, cy, Math.round(r * 1.15), t.pal, 0.85)}`;

const isTg = (s) => /^t\.me\//i.test(s);
const TG = (x, y, fill) => `<path transform="translate(${x} ${y})" d="M0 14 L36 0 L29 36 L19 26 L10 32 L10 20 Z" fill="${fill}"/>`;

/** Плашка со ссылкой: стеклянная или белая (solid). x — левый край, при center — середина. */
function linkPill(text, x, y, t, { solid = false, rot = 0, center = false, size = 38 } = {}) {
  const tg = isTg(text);
  const w = Math.round([...text].length * size * 0.6 + (tg ? 150 : 90));
  const left = center ? Math.round(x - w / 2) : x;
  const h = 92;
  const fill = solid ? '#fff' : 'url(#glass)';
  const stroke = solid ? '' : ` stroke="#fff" stroke-opacity="${t.glass[2]}" stroke-width="2"`;
  const ink = solid ? BLACK : '#fff';
  const g = `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="46" fill="${fill}"${stroke}/>${tg ? TG(left + 38, y + 28, ink) : ''}<text x="${tg ? left + 104 : left + w / 2}" y="${y + 62}" text-anchor="${tg ? 'start' : 'middle'}" font-family="${FONT}" font-weight="600" font-size="${size}" fill="${ink}">${esc(text)}</text>`;
  return { w, h, svg: rot ? `<g transform="rotate(${rot} ${left + w / 2} ${y + h / 2})">${g}</g>` : g };
}

/** Плашка-метка справа вверху («Новый кейс», «Промокод на 24 часа»). */
function tagPill(text, t) {
  const size = 30, w = Math.round([...text].length * size * 0.6 + 60), x = 1404 - w;
  return `<rect x="${x}" y="54" width="${w}" height="64" rx="16" fill="${t.tag.fill}"/><text x="${x + w / 2}" y="96" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="${size}" fill="${t.tag.color}">${esc(text)}</text>`;
}

/** Заголовок. Позиция по одному из: top (верх первой строки), mid (середина блока), last (базовая линия последней строки). */
function head(b, o) {
  const lines = wrapHeadline(b.headline || 'Hustlify', o.maxChars);
  const n = lines.length;
  const fs = Math.max(40, Math.min(fit(lines, o.maxW, o.maxSize, o.k || 0.64), Math.floor(o.maxH / (1 + (n - 1) * 1.08))));
  const lh = fs * 1.08;
  const block = fs + (n - 1) * lh;
  let first;
  if (o.last != null) first = o.last - (n - 1) * lh;
  else if (o.mid != null) first = o.mid - block / 2 + fs * 0.8;
  else first = o.top + fs * 0.8;
  const tspans = lines.map((l, i) => `<tspan x="${o.x}" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  return {
    fs, n, last: first + (n - 1) * lh,
    svg: `<text font-family="${FONT}" font-weight="700" font-size="${fs}" fill="#fff" text-anchor="${o.anchor || 'start'}" letter-spacing="${(-fs * 0.025).toFixed(1)}">${tspans}</text>`,
  };
}

/* ── композиции ── */

// top: заголовок по центру сверху, стеклянная плашка, огромная иконка обрезана снизу
function top(b, t, tone) {
  const h = head(b, { x: 750, anchor: 'middle', top: 150, maxChars: 16, maxW: 1300, maxSize: 126, maxH: 330 });
  const under = h.last + h.fs * 0.25;
  const pill = b.link ? linkPill(b.link, 750, Math.round(under + 40), t, { center: true, rot: -3 }) : null;
  const iconTop = pill ? under + 40 + pill.h + 30 : under + 50;
  const size = 780, cy = Math.round(iconTop + size * 0.4);
  return `${halo(750, cy, [560, 430], tone)}${satellite(b, 170, cy + 80, 92, t, tone)}${satellite(b, 1330, cy - 30, 100, t, tone)}${visual(b, 750, cy, size, t.pal)}${h.svg}${pill?.svg || ''}`;
}

// left: заголовок слева, белая плашка со ссылкой, огромная иконка обрезана справа
function left(b, t, tone) {
  const h = head(b, { x: 96, mid: b.link ? 420 : 480, maxChars: 13, maxW: 700, maxSize: 118, maxH: 420 });
  const pill = b.link ? linkPill(b.link, 96, Math.round(h.last + h.fs * 0.25 + 60), t, { solid: true }) : null;
  return `${halo(1230, 520, [600, 450], tone)}${satellite(b, 700, 880, 66, t, tone)}${visual(b, 1230, 520, 1000, t.pal)}${h.svg}${pill?.svg || ''}`;
}

// corner: иконка обрезана в правом верхнем углу, заголовок и ссылка внизу слева
function corner(b, t, tone) {
  const pill = b.link ? linkPill(b.link, 96, 826, t) : null;
  const h = head(b, { x: 96, last: b.link ? 760 : 880, maxChars: 14, maxW: 680, maxSize: 120, maxH: 380 });
  return `${halo(1160, 260, [560, 420], tone)}${satellite(b, 1330, 820, 84, t, tone)}${visual(b, 1160, 260, 960, t.pal)}${h.svg}${pill?.svg || ''}`;
}

// steps: заголовок и 2–3 пункта на стеклянных карточках, иконка справа
function steps(b, t, tone) {
  const h = head(b, { x: 96, top: 170, maxChars: 16, maxW: 820, maxSize: 84, maxH: 210 });
  const y0 = Math.max(380, Math.round(h.last + h.fs * 0.3 + 50));
  const rows = b.points.map((p, i) => {
    const y = y0 + i * 126;
    const ps = Math.max(26, Math.min(42, Math.floor(540 / ([...p].length * 0.6))));
    return `<rect x="96" y="${y}" width="800" height="104" rx="30" fill="url(#glass)" stroke="#fff" stroke-opacity="${t.glass[2]}" stroke-width="2"/><circle cx="162" cy="${y + 52}" r="34" fill="${t.num}"/><text x="162" y="${y + 64}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="34" fill="#fff">${i + 1}</text><text x="226" y="${Math.round(y + 52 + ps * 0.35)}" font-family="${FONT}" font-weight="600" font-size="${ps}" fill="#fff">${esc(p)}</text>`;
  }).join('');
  const pill = b.link ? linkPill(b.link, 96, 860, t) : null;
  return `${halo(1230, 470, [560, 420], tone)}${visual(b, 1230, 470, 820, t.pal)}${h.svg}${rows}${pill?.svg || ''}`;
}

// poster: огромный заголовок, иконка обрезана в правом нижнем углу
function poster(b, t, tone) {
  const h = head(b, { x: 96, top: 190, maxChars: 11, maxW: 1250, maxSize: 170, maxH: 420, k: 0.66 });
  const pill = b.link ? linkPill(b.link, 96, 860, t) : null;
  return `${halo(1260, 910, [520, 380], tone)}${visual(b, 1260, 910, 720, t.pal)}${h.svg}${pill?.svg || ''}`;
}

/** Композиция: явно заданная (style), иначе по содержанию: пункты → steps, иначе по хэшу заголовка. */
export function pickStyle(b) {
  let s = b.style;
  if (s === 'steps' && b.points.length < 2) s = '';
  if (s && STYLES[s]) return s;
  if (b.points.length >= 2) return 'steps';
  const h = [...b.headline].reduce((a, c) => a + c.codePointAt(0), 0);
  return ['top', 'left', 'corner', 'poster'][h % 4];
}

export function bannerSvg(spec) {
  const b = normalizeBanner(spec);
  const tone = b.layout === 'dark' ? 'dark' : 'light';
  const t = TONES[tone];
  const body = { top, left, corner, steps, poster }[pickStyle(b)](b, t, tone);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1500" height="1000" viewBox="0 0 1500 1000">${backdrop(tone)}${body}${logo()}${b.pill ? tagPill(b.pill, t) : ''}</svg>`;
}

export function renderBanner(spec) {
  const resvg = new Resvg(bannerSvg(spec), {
    fitTo: { mode: 'original' },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Montserrat' },
  });
  return resvg.render().asPng();
}
