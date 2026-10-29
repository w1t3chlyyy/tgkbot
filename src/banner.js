import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ROOT } from './config.js';
import { OBJECTS, OBJECTS3D, STYLES, WORDS } from './prompts.js';

const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const IMG_DIR = path.join(ROOT, 'assets', '3d');
const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONT_DIR, f));
const imgCache = new Map();

// Палитра бренда: только синий, белый и чёрный
const BLUE = '#2447e6';
const INK = '#0b0b0f';
const PAL = {
  light: { ink: INK, acc: BLUE, bg: '#e4e7ec' },
  dark: { ink: '#ffffff', acc: BLUE, bg: '#08090c' },
  blue: { ink: '#ffffff', acc: INK, bg: BLUE },
};
const TONE = {
  light: { ink: INK, card: '#ffffff', line: '#c3c8d0' },
  dark: { ink: '#ffffff', card: '#121318', line: '#2a2d36' },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function normalizeBanner(b = {}, fallback = {}) {
  const x = { layout: 'light', object: 'star', word: 'hustlify', headline: '', pill: '', link: '', style: '', points: [], ...fallback, ...b };
  if (!['light', 'dark'].includes(x.layout)) x.layout = 'light';
  if (!OBJECTS[x.object]) x.object = 'star';
  if (!WORDS[x.word]) x.word = 'hustlify';
  if (!STYLES[x.style]) x.style = '';
  x.points = (Array.isArray(x.points) ? x.points : []).map((p) => String(p ?? '').trim().slice(0, 34)).filter(Boolean).slice(0, 3);
  x.headline = String(x.headline || '').trim().slice(0, 60);
  x.pill = String(x.pill || '').trim().slice(0, 30);
  x.link = String(x.link || '').trim().replace(/^https?:\/\//, '').slice(0, 40);
  return x;
}

function asset(object, word) {
  const file = path.join(IMG_DIR, `${object}_${WORDS[word]}.png`);
  const key = fs.existsSync(file) ? file : path.join(IMG_DIR, 'star_hustlify.png');
  if (!imgCache.has(key)) imgCache.set(key, 'data:image/png;base64,' + fs.readFileSync(key).toString('base64'));
  return imgCache.get(key);
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
const fit = (lines, maxW, maxSize, k = 0.66) => Math.max(34, Math.min(maxSize, Math.floor(maxW / (Math.max(...lines.map((l) => [...l].length)) * k))));
const pillW = (t, size) => Math.round([...t].length * size * 0.62 + 64);

function logo(fill) {
  return `<text x="96" y="104" font-family="Montserrat" font-size="40" fill="${fill}" letter-spacing="1"><tspan font-weight="700">HUSTLI</tspan><tspan font-weight="500">FY</tspan></text>`;
}

/* ── смысловые иконки: рисуются в квадрате 200×200 тремя цветами палитры p = {ink, acc, bg} ── */
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
  bear: (p) => `<circle cx="50" cy="54" r="26" fill="${p.ink}"/><circle cx="150" cy="54" r="26" fill="${p.ink}"/><circle cx="50" cy="54" r="12" fill="${p.acc}"/><circle cx="150" cy="54" r="12" fill="${p.acc}"/><circle cx="100" cy="106" r="66" fill="${p.ink}"/><ellipse cx="100" cy="128" rx="30" ry="23" fill="${p.acc}"/><ellipse cx="100" cy="118" rx="10" ry="7" fill="${p.ink}"/><path d="M100 125 V136 M88 143 Q100 151 112 143" fill="none" stroke="${p.ink}" stroke-width="5" stroke-linecap="round"/><circle cx="76" cy="94" r="8" fill="${p.bg}"/><circle cx="124" cy="94" r="8" fill="${p.bg}"/>`,
  check: (p) => `<circle cx="100" cy="100" r="84" fill="${p.ink}"/><path d="M60 102 L88 130 L142 70" fill="none" stroke="${p.acc}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`,
  tag: (p) => `<path d="M30 30 H110 L178 98 Q186 106 178 114 L114 178 Q106 186 98 178 L30 110 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/><circle cx="66" cy="66" r="12" fill="${p.bg}"/><text x="112" y="124" font-family="Unbounded" font-weight="700" font-size="64" text-anchor="middle" fill="${p.acc}">%</text>`,
  app: (p) => `<rect x="56" y="12" width="88" height="176" rx="20" fill="${p.ink}"/><rect x="66" y="34" width="68" height="118" rx="8" fill="${p.acc}"/><rect x="88" y="19" width="24" height="5" rx="2.5" fill="${p.bg}"/><circle cx="100" cy="170" r="7" fill="${p.bg}"/><rect x="76" y="50" width="48" height="10" rx="5" fill="${p.ink}"/><rect x="76" y="70" width="34" height="10" rx="5" fill="${p.ink}" opacity=".7"/>`,
  team: (p) => `<circle cx="72" cy="66" r="28" fill="${p.ink}"/><path d="M20 172 C20 120 124 120 124 172 Z" fill="${p.ink}"/><circle cx="140" cy="78" r="23" fill="${p.acc}"/><path d="M106 174 C106 134 184 134 184 174 Z" fill="${p.acc}"/>`,
};

/** Главный визуал баннера по центру (cx, cy): 3D-картинка из библиотеки или векторная иконка. */
function visual(b, cx, cy, box, pal, k3d = 1) {
  if (OBJECTS3D[b.object]) {
    const s = Math.round(box * k3d);
    return `<image xlink:href="${asset(b.object, b.word)}" x="${Math.round(cx - s / 2)}" y="${Math.round(cy - s / 2)}" width="${s}" height="${s}"/>`;
  }
  const s = box * 0.7;
  return `<g transform="translate(${Math.round(cx - s / 2)} ${Math.round(cy - s / 2)}) scale(${(s / 200).toFixed(4)})">${(DRAW[b.object] || DRAW.check)(pal)}</g>`;
}

/* ── общие элементы ── */
const PANEL_DEFS = `<defs><linearGradient id="pb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a63f5"/><stop offset="1" stop-color="#1a2fd0"/></linearGradient></defs>`;

function bgLayer(tone) {
  if (tone === 'dark') {
    return `<defs><radialGradient id="g1" cx="50%" cy="95%" r="65%"><stop offset="0" stop-color="${BLUE}" stop-opacity=".6"/><stop offset="1" stop-color="${BLUE}" stop-opacity="0"/></radialGradient><radialGradient id="g2" cx="12%" cy="10%" r="45%"><stop offset="0" stop-color="${BLUE}" stop-opacity=".25"/><stop offset="1" stop-color="${BLUE}" stop-opacity="0"/></radialGradient></defs><rect width="1500" height="1000" fill="#08090c"/><rect width="1500" height="1000" fill="url(#g1)"/><rect width="1500" height="1000" fill="url(#g2)"/>`;
  }
  return `<defs><radialGradient id="bg" cx="70%" cy="40%" r="75%"><stop offset="0" stop-color="#eef0f3"/><stop offset=".6" stop-color="#dcdfe4"/><stop offset="1" stop-color="#c8ccd3"/></radialGradient></defs><rect width="1500" height="1000" fill="url(#bg)"/>`;
}

/** Плашка справа (right — x правого края) */
function pillR(text, right, y, fill = BLUE, color = '#fff') {
  const w = pillW(text, 30), x = right - w;
  return `<rect x="${x}" y="${y}" width="${w}" height="64" rx="14" fill="${fill}"/><text x="${x + w / 2}" y="${y + 43}" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="30" fill="${color}">${esc(text)}</text>`;
}
const pillL = (text, x, y, fill, color) => pillR(text, x + pillW(text, 30), y, fill, color);

/** Круглая плашка со ссылкой (x — левый край) */
function linkPill(text, x, y, tone) {
  const w = pillW(text, 32);
  const rect = tone === 'dark'
    ? `<rect x="${x}" y="${y}" width="${w}" height="72" rx="36" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="72" rx="36" fill="#fff"/>`;
  return `${rect}<text x="${x + w / 2}" y="${y + 48}" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="32" fill="${tone === 'dark' ? '#fff' : BLUE}">${esc(text)}</text>`;
}

/* ── композиции ── */

// hero: 3D-объект (или иконка) на ленте. Светлый и тёмный тон.
function heroLight(b) {
  const lines = wrapHeadline(b.headline || 'Hustlify');
  const fs_ = fit(lines, 760, 78);
  const lh = fs_ * 1.24;
  const last = b.link ? 784 : 880;
  const first = last - (lines.length - 1) * lh;
  const tspans = lines.map((l, i) => `<tspan x="92" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  const pillBottom = first - fs_ * 0.95 - 30;
  const lw = b.link ? pillW(b.link, 34) : 0;
  const is3d = !!OBJECTS3D[b.object];
  return `
<defs>
 <radialGradient id="bg" cx="70%" cy="40%" r="75%"><stop offset="0" stop-color="#eef0f3"/><stop offset=".6" stop-color="#dcdfe4"/><stop offset="1" stop-color="#c8ccd3"/></radialGradient>
 <linearGradient id="tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a63f5" stop-opacity="0"/><stop offset="1" stop-color="#2d4df0" stop-opacity=".95"/></linearGradient>
 <filter id="b28"><feGaussianBlur stdDeviation="28"/></filter><filter id="b2"><feGaussianBlur stdDeviation="2"/></filter>
</defs>
<rect width="1500" height="1000" fill="url(#bg)"/>
<path d="M 120 190 C 380 130 600 210 760 330" fill="none" stroke="url(#tail)" stroke-width="14" stroke-linecap="round" filter="url(#b2)"/>
<path d="M 150 212 C 400 170 590 240 745 350" fill="none" stroke="url(#tail)" stroke-width="5" stroke-linecap="round" opacity=".7"/>
${is3d ? '' : `<circle cx="1090" cy="420" r="300" fill="${BLUE}" opacity=".12"/>`}
<ellipse cx="1090" cy="${is3d ? 800 : 720}" rx="250" ry="24" fill="#000" opacity=".15" filter="url(#b28)"/>
${visual(b, 1090, 410, 800, PAL.light)}
${logo(INK)}
${b.pill ? `<rect x="96" y="${Math.round(pillBottom - 72)}" width="${pillW(b.pill, 30)}" height="72" rx="14" fill="${BLUE}"/><text x="${96 + pillW(b.pill, 30) / 2}" y="${Math.round(pillBottom - 26)}" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="30" fill="#fff">${esc(b.pill)}</text>` : ''}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="${INK}" letter-spacing="-1.5">${tspans}</text>
${b.link ? `<rect x="96" y="830" width="${lw}" height="84" rx="42" fill="#fff"/><text x="${96 + lw / 2}" y="884" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="34" fill="${BLUE}">${esc(b.link)}</text>` : ''}`;
}

function heroDark(b) {
  const lines = wrapHeadline(b.headline || 'Hustlify', 16);
  const fs_ = fit(lines, 1300, lines.length > 1 ? 112 : 150, 0.68);
  const lh = fs_ * 1.12;
  const y0 = Math.round(160 + fs_ * 0.85);
  const tspans = lines.map((l, i) => `<tspan x="750" y="${Math.round(y0 + i * lh)}">${esc(l)}</tspan>`).join('');
  const lw = b.link ? pillW(b.link, 32) : 0;
  const oy = Math.round(y0 + (lines.length - 1) * lh + 10);
  const is3d = !!OBJECTS3D[b.object];
  const cy = is3d ? oy + 390 : Math.min(oy + 330, 660);
  return `
<defs>
 <radialGradient id="g1" cx="50%" cy="85%" r="60%"><stop offset="0" stop-color="#2447e6" stop-opacity=".75"/><stop offset="1" stop-color="#2447e6" stop-opacity="0"/></radialGradient>
 <radialGradient id="g2" cx="12%" cy="10%" r="45%"><stop offset="0" stop-color="#2447e6" stop-opacity=".25"/><stop offset="1" stop-color="#2447e6" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1500" height="1000" fill="#08090c"/><rect width="1500" height="1000" fill="url(#g1)"/><rect width="1500" height="1000" fill="url(#g2)"/>
${is3d ? '' : `<circle cx="750" cy="${cy}" r="300" fill="${BLUE}" opacity=".22"/>`}
${visual(b, 750, cy, 780, PAL.dark)}
${logo('#ffffff')}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="#fff" text-anchor="middle" letter-spacing="-2">${tspans}</text>
${b.pill ? `<rect x="96" y="866" width="${pillW(b.pill, 30)}" height="72" rx="14" fill="${BLUE}"/><text x="${96 + pillW(b.pill, 30) / 2}" y="912" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="30" fill="#fff">${esc(b.pill)}</text>` : ''}
${b.link ? `<rect x="${1404 - lw}" y="860" width="${lw}" height="84" rx="42" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><text x="${1404 - lw / 2}" y="914" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="32" fill="#fff">${esc(b.link)}</text>` : ''}`;
}

// tile: синяя плитка с иконкой по центру, заголовок под ней
function tile(b) {
  const tone = b.layout, t = TONE[tone];
  const lines = wrapHeadline(b.headline || 'Hustlify', 22);
  const fs_ = fit(lines, 1240, 84, 0.7);
  const lh = fs_ * 1.15;
  const first = 700 + fs_ * 0.8;
  const tspans = lines.map((l, i) => `<tspan x="750" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  const lw = b.link ? pillW(b.link, 32) : 0;
  return `${bgLayer(tone)}${PANEL_DEFS}
<rect x="500" y="150" width="500" height="500" rx="124" fill="url(#pb)"/>
<circle cx="920" cy="240" r="90" fill="#fff" opacity=".08"/>
${visual(b, 750, 400, 520, PAL.blue, 1.2)}
${logo(t.ink)}
${b.pill ? pillR(b.pill, 1404, 62) : ''}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="${t.ink}" text-anchor="middle" letter-spacing="-1.5">${tspans}</text>
${b.link ? linkPill(b.link, Math.round(750 - lw / 2), 896, tone) : ''}`;
}

// split: заголовок слева, синяя панель с иконкой справа
function split(b) {
  const tone = b.layout, t = TONE[tone];
  const lines = wrapHeadline(b.headline || 'Hustlify', 13);
  const fs_ = fit(lines, 650, 86, 0.7);
  const lh = fs_ * 1.16;
  const blockH = fs_ + (lines.length - 1) * lh;
  const top = 520 - blockH / 2;
  const first = top + fs_ * 0.82;
  const tspans = lines.map((l, i) => `<tspan x="96" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  return `${bgLayer(tone)}${PANEL_DEFS}
<rect x="800" y="96" width="604" height="808" rx="76" fill="url(#pb)"/>
<circle cx="1102" cy="500" r="250" fill="#fff" opacity=".07"/><circle cx="1102" cy="500" r="165" fill="#fff" opacity=".07"/>
${visual(b, 1102, 500, 560, PAL.blue, 1.05)}
${logo(t.ink)}
${b.pill ? pillL(b.pill, 96, Math.max(150, Math.round(top - 100))) : ''}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="${t.ink}" letter-spacing="-1.5">${tspans}</text>
${b.link ? linkPill(b.link, 96, 820, tone) : ''}`;
}

// steps: заголовок и 2–3 пронумерованных пункта, справа иконка в плитке
function steps(b) {
  const tone = b.layout, t = TONE[tone];
  const lines = wrapHeadline(b.headline || 'Hustlify', 18);
  const fs_ = fit(lines, 880, 70, 0.7);
  const lh = fs_ * 1.16;
  const first = 200 + fs_ * 0.82;
  const tspans = lines.map((l, i) => `<tspan x="96" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  const y0 = Math.max(400, Math.round(first + (lines.length - 1) * lh + fs_ * 0.3 + 56));
  const rows = b.points.map((p, i) => {
    const y = y0 + i * 126;
    const ps = Math.max(26, Math.min(42, Math.floor(700 / ([...p].length * 0.58))));
    return `<rect x="96" y="${y}" width="864" height="104" rx="30" fill="${t.card}" stroke="${t.line}" stroke-width="2"/><circle cx="162" cy="${y + 52}" r="34" fill="${BLUE}"/><text x="162" y="${y + 64}" text-anchor="middle" font-family="Unbounded" font-weight="700" font-size="34" fill="#fff">${i + 1}</text><text x="226" y="${Math.round(y + 52 + ps * 0.35)}" font-family="Montserrat" font-weight="600" font-size="${ps}" fill="${t.ink}">${esc(p)}</text>`;
  }).join('');
  const lw = b.link ? pillW(b.link, 32) : 0;
  return `${bgLayer(tone)}${PANEL_DEFS}
<rect x="1010" y="190" width="394" height="394" rx="96" fill="url(#pb)"/>
${visual(b, 1207, 387, 394, PAL.blue, 1.1)}
${logo(t.ink)}
${b.pill ? pillR(b.pill, 1404, 62) : ''}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="${t.ink}" letter-spacing="-1.5">${tspans}</text>
${rows}
${b.link ? linkPill(b.link, 1404 - lw, 640, tone) : ''}`;
}

// poster: полностью синий постер, огромный заголовок
function poster(b) {
  const lines = wrapHeadline(b.headline || 'Hustlify', 12);
  const fs_ = fit(lines, 760, 120, 0.7);
  const lh = fs_ * 1.08;
  const top = b.pill ? 330 : 250;
  const first = top + fs_ * 0.82;
  const tspans = lines.map((l, i) => `<tspan x="96" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  return `${PANEL_DEFS}<rect width="1500" height="1000" fill="url(#pb)"/>
<circle cx="1260" cy="900" r="520" fill="#000" opacity=".12"/><circle cx="1420" cy="80" r="300" fill="#fff" opacity=".07"/>
${visual(b, 1130, 640, 640, PAL.blue, 1.1)}
${logo('#ffffff')}
${b.pill ? pillL(b.pill, 96, 200, INK, '#fff') : ''}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="#fff" letter-spacing="-2">${tspans}</text>
${b.link ? linkPill(b.link, 96, 850, 'light') : ''}`;
}

/** Композиция: явно заданная (style), иначе по содержанию: пункты → steps, 3D → hero, иконка → tile/split/poster по хэшу заголовка. */
export function pickStyle(b) {
  let s = b.style;
  if (s === 'steps' && b.points.length < 2) s = '';
  if (s) return s;
  if (b.points.length >= 2) return 'steps';
  if (OBJECTS3D[b.object]) return 'hero';
  const h = [...b.headline].reduce((a, c) => a + c.codePointAt(0), 0);
  return ['tile', 'split', 'poster'][h % 3];
}

export function bannerSvg(spec) {
  const b = normalizeBanner(spec);
  const s = pickStyle(b);
  const body = s === 'hero' ? (b.layout === 'dark' ? heroDark(b) : heroLight(b)) : { tile, split, steps, poster }[s](b);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1500" height="1000" viewBox="0 0 1500 1000">${body}</svg>`;
}

export function renderBanner(spec) {
  const resvg = new Resvg(bannerSvg(spec), {
    fitTo: { mode: 'original' },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Montserrat' },
  });
  return resvg.render().asPng();
}
