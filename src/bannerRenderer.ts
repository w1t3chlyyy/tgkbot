import { BannerSpec } from './types';

const W = 1500;
const H = 1000;
const BLACK = '#0b0b0f';
const BLUE = '#2447e6';
const BLUE2 = '#3a63f5';
const FONT = 'Montserrat, Inter, system-ui, sans-serif';

export const PAL: Record<string, any> = {
  dark: {
    bg: '#07080b',
    fg: '#fff',
    face: ['#ffffff', '#c4c8d1', '#4d515c'],
    side: ['#8d919c', '#0b0c10'],
    inner: ['#0b0c10', '#2a2d36'],
    tile: ['#50545f', '#0d0e12'],
    ink: ['#ffffff', '#cfd3dc'],
    acc: BLUE2,
    cut: '#15171c',
    glow: '#8e97ad',
    glowOp: '.22',
    glass: ['#fff', '.16', '.05'],
    gStroke: '#fff',
    gOp: '.28',
    dotBg: '#fff',
    dotFg: BLUE,
    inv: false,
  },
  light: {
    bg: '#eef0f4',
    fg: BLACK,
    face: ['#5a5e69', '#1b1c21', '#050506'],
    side: ['#2c2f37', '#000000'],
    inner: ['#0b0c10', '#2a2d36'],
    tile: ['#3b3e48', '#0a0a0d'],
    ink: ['#ffffff', '#cfd3dc'],
    acc: BLUE2,
    cut: '#15171c',
    glow: '#2f56ff',
    glowOp: '.2',
    glass: ['#000', '.10', '.04'],
    gStroke: '#000',
    gOp: '.18',
    dotBg: BLACK,
    dotFg: '#fff',
    inv: true,
  },
  blue: {
    bg: '#1727c4',
    fg: '#fff',
    face: ['#d4deff', '#7f9bff', '#2b46ee'],
    side: ['#3550f0', '#0c1676'],
    inner: ['#2540e6', '#6d8cff'],
    tile: ['#7d99ff', '#2a45ee'],
    ink: ['#ffffff', '#d3dfff'],
    acc: BLACK,
    cut: '#dbe3ff',
    glow: '#2f56ff',
    glowOp: '.35',
    glass: ['#fff', '.3', '.1'],
    gStroke: '#fff',
    gOp: '.4',
    dotBg: '#fff',
    dotFg: BLUE,
    inv: false,
  },
};

export const OBJECTS: Record<string, string> = {
  case: 'кейс, портфолио, результат клиента',
  crown: 'премиум-кейс, топ-результат, лучшее',
  chart: 'результаты, заработок, статистика, рост',
  team: 'команда, найм, вакансия в продажи, люди',
  play: 'видео, съёмка, вакансия видеооператора',
  chat: 'диалог, обсуждение, обучение, возражения клиентов',
  trophy: 'конкурс, победа, итоги, награда',
  rocket: 'запуск, новинка, быстрый старт',
  shield: 'безопасность, гарантия, доверие',
  check: 'готово, шаги, инструкция',
  app: 'мини-приложение, бот, сервис, телефон',
  globe: 'сайт, интернет, веб-проекты',
  bolt: 'скорость, мгновенная выдача',
  tag: 'скидка, цена, промокод',
  gift: 'подарок, бонус, приз',
  heart: 'благодарность, комьюнити, отзывы',
  note: 'музыка, TikTok',
  bear: 'мишка, подарок в Telegram',
  star: 'только пост про Telegram Stars',
  gem: 'только пост про Telegram Premium',
};

export const LAYOUTS: Record<string, string> = {
  dark: 'чёрный (основной)',
  light: 'белый',
  blue: 'синий',
};

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function normalizeBannerSpec(b: Partial<BannerSpec> = {}, fallback: Partial<BannerSpec> = {}): BannerSpec {
  const layout = (b.layout || fallback.layout || 'dark') as 'dark' | 'light' | 'blue';
  const object = b.object || fallback.object || 'case';
  const points = (Array.isArray(b.points) ? b.points : fallback.points || [])
    .map((p) => String(p ?? '').trim().slice(0, 34))
    .filter(Boolean)
    .slice(0, 3);

  return {
    layout: PAL[layout] ? layout : 'dark',
    object: OBJECTS[object] ? object : 'case',
    word: b.word || fallback.word || 'hustlify',
    headline: String(b.headline || fallback.headline || 'Hustlify').trim().slice(0, 60),
    sub: String(b.sub ?? fallback.sub ?? '').trim().slice(0, 80),
    pill: String(b.pill ?? fallback.pill ?? '').trim().slice(0, 30),
    link: String(b.link ?? fallback.link ?? '').trim().replace(/^https?:\/\//, '').slice(0, 40),
    style: b.style || fallback.style || '',
    points,
  };
}

const starPts = (cx: number, cy: number, R: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    return `${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`;
  }).join(' ');

const DRAW: Record<string, (p: { ink: string; acc: string; bg: string }) => string> = {
  gift: (p) =>
    `<rect x="26" y="70" width="148" height="40" rx="10" fill="${p.ink}"/><rect x="38" y="110" width="124" height="74" rx="10" fill="${p.acc}"/><rect x="90" y="70" width="20" height="114" fill="${p.bg}"/><ellipse cx="70" cy="52" rx="30" ry="18" transform="rotate(-24 70 52)" fill="${p.ink}"/><ellipse cx="130" cy="52" rx="30" ry="18" transform="rotate(24 130 52)" fill="${p.ink}"/><circle cx="100" cy="62" r="12" fill="${p.acc}"/>`,
  gem: (p) =>
    `<path d="M58 40 H142 L184 92 L100 178 L16 92 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/><path d="M16 92 H184 M58 40 L78 92 L100 178 M142 40 L122 92 L100 178" fill="none" stroke="${p.bg}" stroke-width="7" stroke-linejoin="round"/><path d="M78 92 L100 40 L122 92" fill="none" stroke="${p.acc}" stroke-width="9" stroke-linejoin="round"/>`,
  bolt: (p) =>
    `<path d="M118 22 L46 112 H92 L80 180 L158 82 H110 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="8" stroke-linejoin="round"/>`,
  chat: (p) =>
    `<rect x="16" y="30" width="168" height="112" rx="30" fill="${p.ink}"/><path d="M58 136 L46 184 L100 140 Z" fill="${p.ink}"/><circle cx="62" cy="86" r="12" fill="${p.acc}"/><circle cx="100" cy="86" r="12" fill="${p.acc}"/><circle cx="138" cy="86" r="12" fill="${p.acc}"/>`,
  case: (p) =>
    `<path d="M74 66 V50 a12 12 0 0 1 12 -12 H114 a12 12 0 0 1 12 12 V66" fill="none" stroke="${p.ink}" stroke-width="12" stroke-linecap="round"/><rect x="18" y="64" width="164" height="112" rx="18" fill="${p.ink}"/><rect x="18" y="108" width="164" height="14" fill="${p.acc}"/><rect x="87" y="98" width="26" height="34" rx="7" fill="${p.bg}" stroke="${p.acc}" stroke-width="6"/>`,
  rocket: (p) =>
    `<path d="M64 124 L28 162 L68 152 Z" fill="${p.acc}"/><path d="M136 124 L172 162 L132 152 Z" fill="${p.acc}"/><path d="M100 12 C142 44 152 100 138 146 H62 C48 100 58 44 100 12 Z" fill="${p.ink}"/><circle cx="100" cy="76" r="17" fill="${p.acc}"/><circle cx="100" cy="76" r="8" fill="${p.bg}"/><path d="M80 154 Q100 200 120 154 Z" fill="${p.acc}"/>`,
  note: (p) =>
    `<rect x="78" y="42" width="14" height="108" fill="${p.ink}"/><rect x="156" y="24" width="14" height="108" fill="${p.ink}"/><circle cx="62" cy="150" r="28" fill="${p.ink}"/><circle cx="140" cy="132" r="28" fill="${p.ink}"/><path d="M78 42 L170 24 V60 L78 78 Z" fill="${p.acc}"/>`,
  heart: (p) =>
    `<path d="M100 178 C22 122 8 72 44 48 C70 32 92 44 100 64 C108 44 130 32 156 48 C192 72 178 122 100 178 Z" fill="${p.ink}"/><path d="M52 70 C58 60 70 58 78 64" fill="none" stroke="${p.acc}" stroke-width="10" stroke-linecap="round"/>`,
  shield: (p) =>
    `<path d="M100 14 L170 42 V96 C170 140 140 168 100 188 C60 168 30 140 30 96 V42 Z" fill="${p.ink}"/><path d="M66 100 L90 124 L136 74" fill="none" stroke="${p.acc}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
  chart: (p) =>
    `<rect x="22" y="120" width="34" height="56" rx="8" fill="${p.ink}"/><rect x="68" y="92" width="34" height="84" rx="8" fill="${p.ink}"/><rect x="114" y="62" width="34" height="114" rx="8" fill="${p.ink}"/><path d="M24 78 L76 46 L104 62 L158 26" fill="none" stroke="${p.acc}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M168 14 L184 56 L140 40 Z" fill="${p.acc}"/>`,
  trophy: (p) =>
    `<path d="M54 28 H146 V92 C146 124 126 142 100 142 C74 142 54 124 54 92 Z" fill="${p.ink}"/><path d="M54 44 H28 C28 84 42 100 64 104" fill="none" stroke="${p.ink}" stroke-width="10" stroke-linecap="round"/><path d="M146 44 H172 C172 84 158 100 136 104" fill="none" stroke="${p.ink}" stroke-width="10" stroke-linecap="round"/><rect x="90" y="140" width="20" height="26" fill="${p.ink}"/><rect x="60" y="164" width="80" height="20" rx="8" fill="${p.acc}"/><circle cx="100" cy="78" r="16" fill="${p.acc}"/>`,
  bear: (p) =>
    `<circle cx="50" cy="54" r="26" fill="${p.ink}"/><circle cx="150" cy="54" r="26" fill="${p.ink}"/><circle cx="50" cy="54" r="12" fill="${p.acc}"/><circle cx="150" cy="54" r="12" fill="${p.acc}"/><circle cx="100" cy="106" r="66" fill="${p.ink}"/><ellipse cx="100" cy="128" rx="30" ry="23" fill="${p.acc}"/><ellipse cx="100" cy="118" rx="10" ry="7" fill="${p.ink}"/><path d="M100 125 V136 M88 143 Q100 151 112 143" fill="none" stroke="${p.ink}" stroke-width="5" stroke-linecap="round"/><circle cx="76" cy="94" r="8" fill="${BLACK}"/><circle cx="124" cy="94" r="8" fill="${BLACK}"/>`,
  check: (p) =>
    `<circle cx="100" cy="100" r="84" fill="${p.ink}"/><path d="M60 102 L88 130 L142 70" fill="none" stroke="${p.acc}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`,
  tag: (p) =>
    `<path d="M30 30 H110 L178 98 Q186 106 178 114 L114 178 Q106 186 98 178 L30 110 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/><circle cx="66" cy="66" r="12" fill="${p.bg}"/><circle cx="88" cy="96" r="10" fill="${p.acc}"/><circle cx="120" cy="128" r="10" fill="${p.acc}"/><path d="M126 86 L82 138" stroke="${p.acc}" stroke-width="9" stroke-linecap="round"/>`,
  app: (p) =>
    `<rect x="56" y="12" width="88" height="176" rx="20" fill="${p.ink}"/><rect x="66" y="34" width="68" height="118" rx="8" fill="${p.acc}"/><rect x="88" y="19" width="24" height="5" rx="2.5" fill="${p.bg}"/><circle cx="100" cy="170" r="7" fill="${p.bg}"/>`,
  team: (p) =>
    `<g fill="${p.ink}" fill-opacity=".5"><circle cx="36" cy="86" r="20"/><path d="M2 170 C2 132 70 132 70 170 Z"/><circle cx="164" cy="86" r="20"/><path d="M130 170 C130 132 198 132 198 170 Z"/></g><circle cx="100" cy="64" r="34" fill="${p.ink}"/><path d="M34 178 C34 120 166 120 166 178 Z" fill="${p.ink}"/>`,
  play: (p) =>
    `<rect x="14" y="40" width="172" height="120" rx="34" fill="${p.ink}"/><path d="M82 72 L134 100 L82 128 Z" fill="${p.acc}" stroke="${p.acc}" stroke-width="8" stroke-linejoin="round"/>`,
  star: (p) =>
    `<polygon points="${starPts(100, 106, 88, 40)}" fill="${p.ink}" stroke="${p.ink}" stroke-width="14" stroke-linejoin="round"/>`,
  crown: (p) =>
    `<path d="M22 150 L14 62 L62 102 L100 42 L138 102 L186 62 L178 150 Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="8" stroke-linejoin="round"/><rect x="24" y="158" width="152" height="24" rx="9" fill="${p.acc}"/><circle cx="14" cy="60" r="12" fill="${p.ink}"/><circle cx="100" cy="38" r="12" fill="${p.ink}"/><circle cx="186" cy="60" r="12" fill="${p.ink}"/><circle cx="100" cy="122" r="13" fill="${p.acc}"/>`,
  globe: (p) =>
    `<circle cx="100" cy="100" r="84" fill="none" stroke="${p.ink}" stroke-width="16"/><ellipse cx="100" cy="100" rx="38" ry="84" fill="none" stroke="${p.ink}" stroke-width="14"/><path d="M16 100 H184 M30 58 H170 M30 142 H170" fill="none" stroke="${p.ink}" stroke-width="12"/>`,
};

export function wrapHeadline(text: string, maxChars = 18): string[] {
  const glued = String(text)
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00A0')
    .replace(/ (?=[₽%€$])/g, '\u00A0');
  let lines = glued.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && [...lines[0]].length > maxChars) {
    const w = lines[0].split(/ +/);
    let best = 1, diff = 1e9;
    for (let i = 1; i < w.length; i++) {
      const d = Math.abs([...w.slice(0, i).join(' ')].length - [...w.slice(i).join(' ')].length);
      if (d < diff) { diff = d; best = i; }
    }
    while (best > 1 && [...w[best - 1]].length <= 2) best--;
    lines = w.length > 1 ? [w.slice(0, best).join(' '), w.slice(best).join(' ')] : lines;
  }
  return lines.slice(0, 3);
}

const fit = (lines: string[], maxW: number, maxSize: number, k = 0.68) =>
  Math.max(34, Math.min(maxSize, Math.floor(maxW / (Math.max(...lines.map((l) => [...l].length)) * k))));

const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

let seq = 0;

export function bannerSvg(spec: Partial<BannerSpec>): string {
  seq = 0;
  const b = normalizeBannerSpec(spec);
  const tone = PAL[b.layout] ? b.layout : 'dark';
  const T = PAL[tone];

  const iconPal = () => ({ ink: 'url(#iInk)', acc: T.acc, bg: T.cut });

  const renderIcon = (cx: number, cy: number, size: number, shadow = true) => {
    const draw = DRAW[b.object] || DRAW.case;
    const g = `<g transform="translate(${Math.round(cx - size / 2)} ${Math.round(cy - size / 2)}) scale(${(size / 200).toFixed(4)})">${draw(iconPal())}</g>`;
    return shadow ? `<g filter="url(#drop)">${g}</g>` : g;
  };

  const renderCoin = (cx: number, cy: number, R: number, { blur = 0, opacity = 1, lean = 1 } = {}) => {
    const id = `cl${++seq}`;
    const ox = Math.round(R * 0.09 * lean);
    const oy = Math.round(R * 0.11);
    const N = 18;
    let side = '';
    for (let i = N; i >= 1; i--) {
      side += `<circle cx="${cx + (ox * i) / N}" cy="${cy + (oy * i) / N}" r="${R}" fill="${mix(T.side[0], T.side[1], i / N)}"/>`;
    }
    const body = `${side}
<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#cFace)"/>
<circle cx="${cx}" cy="${cy}" r="${R - R * 0.018}" fill="none" stroke="url(#cRim)" stroke-width="${Math.round(R * 0.04)}"/>
<circle cx="${cx}" cy="${cy}" r="${Math.round(R * 0.80)}" fill="url(#cInner)"/>
<circle cx="${cx}" cy="${cy}" r="${Math.round(R * 0.80)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${Math.round(R * 0.025)}"/>
<circle cx="${cx}" cy="${cy}" r="${Math.round(R * 0.80 + R * 0.02)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
<ellipse cx="${Math.round(cx - R * 0.28)}" cy="${Math.round(cy - R * 0.55)}" rx="${Math.round(R * 0.95)}" ry="${Math.round(R * 0.5)}" transform="rotate(-24 ${cx} ${cy})" fill="url(#gloss)" clip-path="url(#${id})"/>
${renderIcon(cx, cy + Math.round(R * 0.02), Math.round(R * 1.12))}`;
    const attrs = `${opacity < 1 ? ` opacity="${opacity}"` : ''}${blur ? ` filter="url(#blur${blur})"` : ''}`;
    return `<g${attrs}>${body}</g>`;
  };

  const renderTile = (cx: number, cy: number, S: number, { rot = 0, opacity = 1 } = {}) => {
    const x = Math.round(cx - S / 2);
    const y = Math.round(cy - S / 2);
    const r = Math.round(S * 0.27);
    const pad = Math.round(S * 0.05);
    return `<g transform="rotate(${rot} ${cx} ${cy})"${opacity < 1 ? ` opacity="${opacity}"` : ''}><g filter="url(#tileShadow)">
<rect x="${x}" y="${y}" width="${S}" height="${S}" rx="${r}" fill="url(#tRim)"/>
<rect x="${x + pad}" y="${y + pad}" width="${S - 2 * pad}" height="${S - 2 * pad}" rx="${Math.round(r * 0.8)}" fill="url(#tFace)"/>
<rect x="${x + pad}" y="${y + pad}" width="${S - 2 * pad}" height="${Math.round(S * 0.5)}" rx="${Math.round(r * 0.8)}" fill="url(#tGloss)"/></g>
${renderIcon(cx, cy + Math.round(S * 0.01), Math.round(S * 0.66))}</g>`;
  };

  const defs = () => `<defs>
<linearGradient id="iInk" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200"><stop offset="0" stop-color="${T.ink[0]}"/><stop offset="1" stop-color="${T.ink[1]}"/></linearGradient>
<linearGradient id="cFace" x1=".12" y1=".02" x2=".88" y2=".98"><stop offset="0" stop-color="${T.face[0]}"/><stop offset=".3" stop-color="${T.face[1]}"/><stop offset="1" stop-color="${T.face[2]}"/></linearGradient>
<linearGradient id="cRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>
<linearGradient id="cInner" x1=".1" y1=".05" x2=".9" y2=".95"><stop offset="0" stop-color="${T.inner[0]}"/><stop offset="1" stop-color="${T.inner[1]}"/></linearGradient>
<radialGradient id="gloss" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="tRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".55" stop-color="#cdd9ff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity=".6"/></linearGradient>
<linearGradient id="tFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.tile[0]}"/><stop offset="1" stop-color="${T.tile[1]}"/></linearGradient>
<linearGradient id="tGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.glass[0]}" stop-opacity="${T.glass[1]}"/><stop offset="1" stop-color="${T.glass[0]}" stop-opacity="${T.glass[2]}"/></linearGradient>
<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="blur12" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="blur18" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="blur40" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
<filter id="drop" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="7" result="b"/><feOffset in="b" dx="0" dy="9" result="o"/><feFlood flood-color="#000" flood-opacity=".5" result="f"/><feComposite in="f" in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="tileShadow" x="-25%" y="-25%" width="150%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="22" result="b"/><feOffset in="b" dx="0" dy="26" result="o"/><feFlood flood-color="#000" flood-opacity=".4" result="f"/><feComposite in="f" in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

  const backdrop = () => {
    if (tone === 'dark') {
      let flutes = '';
      for (let x = 0; x < W; x += 24) flutes += `<rect x="${x}" y="0" width="11" height="${H}" fill="#fff" fill-opacity=".022"/>`;
      return `<defs><radialGradient id="g1" cx=".8" cy="1" r=".9"><stop offset="0" stop-color="#5a6070" stop-opacity=".55"/><stop offset="1" stop-color="#5a6070" stop-opacity="0"/></radialGradient><radialGradient id="g2" cx=".05" cy="0" r=".45"><stop offset="0" stop-color="#2447e6" stop-opacity=".28"/><stop offset="1" stop-color="#2447e6" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="#07080b"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>${flutes}`;
    }
    if (tone === 'light') {
      return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fafafb"/><stop offset="1" stop-color="#d3d6de"/></linearGradient><radialGradient id="vig" cx=".85" cy="1" r=".9"><stop offset="0" stop-color="#8d93a3" stop-opacity=".45"/><stop offset="1" stop-color="#8d93a3" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#vig)"/>`;
    }
    return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5f84ff"/><stop offset="1" stop-color="#1727c4"/></linearGradient><radialGradient id="vig" cx=".85" cy="1" r=".9"><stop offset="0" stop-color="#0a1250" stop-opacity=".5"/><stop offset="1" stop-color="#0a1250" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#vig)"/>
<g filter="url(#blur12)"><polygon points="260,0 420,0 140,1000 -40,1000" fill="url(#ray)" opacity=".7"/><polygon points="560,0 640,0 420,1000 330,1000" fill="url(#ray)" opacity=".5"/><polygon points="900,0 1060,0 800,1000 650,1000" fill="url(#ray)" opacity=".35"/></g>`;
  };

  const renderLogo = () => {
    return `<text x="96" y="104" font-family="${FONT}" font-size="36" fill="${T.fg}" letter-spacing="1"><tspan font-weight="700">HUSTLI</tspan><tspan font-weight="400">FY</tspan></text>`;
  };

  const head = (o: any) => {
    const lines = wrapHeadline(b.headline || 'Hustlify', o.maxChars);
    const n = lines.length;
    const fs = Math.max(40, Math.min(fit(lines, o.maxW, o.maxSize, o.k || 0.68), Math.floor(o.maxH / (1 + (n - 1) * 1.08))));
    const lh = fs * 1.08;
    const block = fs + (n - 1) * lh;
    let first: number;
    if (o.last != null) first = o.last - (n - 1) * lh;
    else if (o.mid != null) first = o.mid - block / 2 + fs * 0.8;
    else first = o.top + fs * 0.8;
    const tspans = lines.map((l, i) => `<tspan x="${o.x}" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
    return {
      fs,
      n,
      first,
      last: first + (n - 1) * lh,
      bottom: first + (n - 1) * lh + fs * 0.25,
      svg: `<text font-family="${FONT}" font-weight="700" font-size="${fs}" fill="${T.fg}" text-anchor="${o.anchor || 'start'}" letter-spacing="${(-fs * 0.025).toFixed(1)}">${tspans}</text>`,
    };
  };

  const sub = (x: number, first: number, { anchor = 'start', maxChars = 30, size = 40 } = {}) => {
    if (!b.sub) return { svg: '', n: 0, lh: Math.round(size * 1.35), bottom: first - size };
    const lines = wrapHeadline(b.sub, maxChars).slice(0, 2);
    const lh = Math.round(size * 1.35);
    const ts = lines.map((l, i) => `<tspan x="${x}" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
    return {
      n: lines.length,
      lh,
      bottom: first + (lines.length - 1) * lh + 14,
      svg: `<text font-family="${FONT}" font-weight="500" font-size="${size}" fill="${T.fg}" fill-opacity=".68" text-anchor="${anchor}">${ts}</text>`,
    };
  };

  const linkPill = (x: number, y: number, { center = false, size = 38 } = {}) => {
    const label = b.link || 'hustlify.site';
    const isTg = /^t\.me\//i.test(label);
    const h = 92;
    const w = Math.round([...label].length * size * 0.6 + (isTg ? 150 : 90));
    const left = center ? Math.round(x - w / 2) : x;
    const stroke = ` stroke="${T.gStroke}" stroke-opacity="${T.gOp}" stroke-width="2"`;
    if (!isTg) {
      return {
        w,
        h,
        svg: `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="46" fill="url(#glass)"${stroke}/><text x="${left + w / 2}" y="${y + 62}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="${size}" fill="${T.fg}">${esc(label)}</text>`,
      };
    }
    return {
      w,
      h,
      svg: `<rect x="${left + 40}" y="${y}" width="${w - 40}" height="${h}" rx="46" fill="url(#glass)"${stroke}/><circle cx="${left + 46}" cy="${y + 46}" r="46" fill="${T.dotBg}"/><path transform="translate(${left + 26} ${y + 27}) scale(1.1)" d="M0 14 L36 0 L29 36 L19 26 L10 32 L10 20 Z" fill="${T.dotFg}"/><text x="${left + 114}" y="${y + 62}" font-family="${FONT}" font-weight="600" font-size="${size}" fill="${T.fg}">${esc(label)}</text>`,
    };
  };

  const tagPill = (text: string) => {
    const size = 30;
    const w = Math.round([...text].length * size * 0.6 + 60);
    const x = 1404 - w;
    const fill = tone === 'dark' ? BLUE : BLACK;
    return `<rect x="${x}" y="54" width="${w}" height="${64}" rx="16" fill="${fill}"/><text x="${x + w / 2}" y="96" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="${size}" fill="#fff">${esc(text)}</text>`;
  };

  // Compositions
  const coinLayout = () => {
    const hasSub = !!b.sub;
    const h = head({ x: 96, mid: hasSub ? 390 : 440, maxChars: 13, maxW: 660, maxSize: 124, maxH: 360 });
    const s = sub(96, Math.round(h.bottom + 56), { maxChars: 27 });
    const pill = b.link ? linkPill(96, 800) : null;
    const glow =
      tone === 'dark'
        ? `<circle cx="1160" cy="560" r="420" fill="${T.glow}" opacity="${T.glowOp}" filter="url(#blur40)"/>`
        : `<ellipse cx="1190" cy="890" rx="310" ry="46" fill="#000" opacity=".35" filter="url(#blur18)"/>`;
    return `${glow}${renderCoin(770, 190, 150, { blur: 12, opacity: 0.55 })}${renderCoin(1390, 250, 100, { blur: 12, opacity: 0.45 })}${renderCoin(1160, 500, 310)}${h.svg}${s.svg}${pill?.svg || ''}`;
  };

  const tilesLayout = () => {
    const h = head({ x: 750, anchor: 'middle', top: 150, maxChars: 16, maxW: 1300, maxSize: 118, maxH: 250 });
    const s = sub(750, Math.round(h.bottom + 52), { anchor: 'middle', maxChars: 40, size: 38 });
    const flow = s.n ? s.bottom : h.bottom;
    const pill = b.link ? linkPill(750, Math.round(flow + 34), { center: true }) : null;
    const bottom = pill ? flow + 34 + pill.h : flow;
    const top = Math.max(560, Math.round(bottom + 40));
    const S = 560;
    const cy = top + Math.round(S * 0.5);
    const glow = tone === 'dark' ? `<circle cx="750" cy="${top + 300}" r="420" fill="${T.glow}" opacity="${T.glowOp}" filter="url(#blur40)"/>` : '';
    return `${glow}${renderTile(215, cy + 40, 430, { rot: -11, opacity: 0.92 })}${renderTile(1285, cy + 40, 430, { rot: 11, opacity: 0.92 })}${renderTile(750, cy, S)}${h.svg}${s.svg}${pill?.svg || ''}`;
  };

  const cornerLayout = () => {
    const pill = b.link ? linkPill(96, 836) : null;
    const lastBase = b.link ? 790 : 900;
    const s = b.sub ? sub(96, lastBase - 52, { maxChars: 30, size: 38 }) : null;
    const headLast = s ? lastBase - 52 * Math.max(s.n, 1) - 70 : lastBase;
    const h = head({ x: 96, last: headLast, maxChars: 14, maxW: 690, maxSize: 118, maxH: 330 });
    const glow = tone === 'dark' ? `<circle cx="1180" cy="300" r="430" fill="${T.glow}" opacity="${T.glowOp}" filter="url(#blur40)"/>` : '';
    return `${glow}${renderCoin(1480, 640, 120, { blur: 12, opacity: 0.5 })}${renderCoin(1180, 280, 400)}${h.svg}${s?.svg || ''}${pill?.svg || ''}`;
  };

  const stepsLayout = () => {
    const h = head({ x: 96, top: 170, maxChars: 16, maxW: 800, maxSize: 84, maxH: 200 });
    const y0 = Math.max(370, Math.round(h.bottom + 56));
    const rows = (b.points || ['Шаг 1', 'Шаг 2']).map((p, i) => {
      const y = y0 + i * 124;
      const ps = Math.max(26, Math.min(42, Math.floor(520 / ([...p].length * 0.6))));
      return `<rect x="96" y="${y}" width="760" height="100" rx="30" fill="url(#glass)" stroke="${T.gStroke}" stroke-opacity="${T.gOp}" stroke-width="2"/><circle cx="160" cy="${y + 50}" r="33" fill="${tone === 'dark' ? BLUE : BLACK}"/><text x="160" y="${y + 62}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="34" fill="#fff">${i + 1}</text><text x="222" y="${Math.round(y + 50 + ps * 0.35)}" font-family="${FONT}" font-weight="600" font-size="${ps}" fill="${T.fg}">${esc(p)}</text>`;
    }).join('');
    const pill = b.link ? linkPill(96, 868) : null;
    const glow = tone === 'dark' ? `<circle cx="1230" cy="520" r="400" fill="${T.glow}" opacity="${T.glowOp}" filter="url(#blur40)"/>` : '';
    return `${glow}${renderCoin(1100, 160, 90, { blur: 12, opacity: 0.45 })}${renderCoin(1250, 540, 310)}${h.svg}${rows}${pill?.svg || ''}`;
  };

  // Pick style
  let style = b.style;
  if (style === 'steps' && (!b.points || b.points.length < 2)) style = '';
  if (!style) {
    if (b.points && b.points.length >= 2) style = 'steps';
    else {
      const hVal = [...b.headline].reduce((a, c) => a + (c.codePointAt(0) || 0), 0);
      style = (['coin', 'tiles', 'corner'] as const)[hVal % 3];
    }
  }

  const body = style === 'tiles' ? tilesLayout() : style === 'corner' ? cornerLayout() : style === 'steps' ? stepsLayout() : coinLayout();

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}${backdrop()}${body}${renderLogo()}${b.pill ? tagPill(b.pill) : ''}</svg>`;
}
