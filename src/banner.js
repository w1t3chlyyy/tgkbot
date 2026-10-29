import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ROOT } from './config.js';
import { OBJECTS, WORDS } from './prompts.js';

const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const IMG_DIR = path.join(ROOT, 'assets', '3d');
const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONT_DIR, f));
const imgCache = new Map();

const BLUE = '#2447e6';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function normalizeBanner(b = {}, fallback = {}) {
  const x = { layout: 'light', object: 'star', word: 'hustlify', headline: '', pill: '', link: '', ...fallback, ...b };
  if (!['light', 'dark'].includes(x.layout)) x.layout = 'light';
  if (!OBJECTS[x.object]) x.object = 'star';
  if (!WORDS[x.word]) x.word = 'hustlify';
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

function light(b) {
  const lines = wrapHeadline(b.headline || 'Hustlify');
  const fs_ = fit(lines, 760, 78);
  const lh = fs_ * 1.24;
  const last = b.link ? 784 : 880;
  const first = last - (lines.length - 1) * lh;
  const tspans = lines.map((l, i) => `<tspan x="92" y="${Math.round(first + i * lh)}">${esc(l)}</tspan>`).join('');
  const pillBottom = first - fs_ * 0.95 - 30;
  const lw = b.link ? pillW(b.link, 34) : 0;
  return `
<defs>
 <radialGradient id="bg" cx="70%" cy="40%" r="75%"><stop offset="0" stop-color="#eef0f3"/><stop offset=".6" stop-color="#dcdfe4"/><stop offset="1" stop-color="#c8ccd3"/></radialGradient>
 <linearGradient id="tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a63f5" stop-opacity="0"/><stop offset="1" stop-color="#2d4df0" stop-opacity=".95"/></linearGradient>
 <filter id="b28"><feGaussianBlur stdDeviation="28"/></filter><filter id="b2"><feGaussianBlur stdDeviation="2"/></filter>
</defs>
<rect width="1500" height="1000" fill="url(#bg)"/>
<path d="M 120 190 C 380 130 600 210 760 330" fill="none" stroke="url(#tail)" stroke-width="14" stroke-linecap="round" filter="url(#b2)"/>
<path d="M 150 212 C 400 170 590 240 745 350" fill="none" stroke="url(#tail)" stroke-width="5" stroke-linecap="round" opacity=".7"/>
<ellipse cx="1090" cy="800" rx="250" ry="24" fill="#000" opacity=".15" filter="url(#b28)"/>
<image xlink:href="${asset(b.object, b.word)}" x="690" y="10" width="800" height="800"/>
${logo('#0b0b0f')}
${b.pill ? `<rect x="96" y="${Math.round(pillBottom - 72)}" width="${pillW(b.pill, 30)}" height="72" rx="14" fill="${BLUE}"/><text x="${96 + pillW(b.pill, 30) / 2}" y="${Math.round(pillBottom - 26)}" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="30" fill="#fff">${esc(b.pill)}</text>` : ''}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="#0b0b0f" letter-spacing="-1.5">${tspans}</text>
${b.link ? `<rect x="96" y="830" width="${lw}" height="84" rx="42" fill="#fff"/><text x="${96 + lw / 2}" y="884" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="34" fill="${BLUE}">${esc(b.link)}</text>` : ''}`;
}

function dark(b) {
  const lines = wrapHeadline(b.headline || 'Hustlify', 16);
  const fs_ = fit(lines, 1300, lines.length > 1 ? 112 : 150, 0.68);
  const lh = fs_ * 1.12;
  const y0 = Math.round(160 + fs_ * 0.85);
  const tspans = lines.map((l, i) => `<tspan x="750" y="${Math.round(y0 + i * lh)}">${esc(l)}</tspan>`).join('');
  const lw = b.link ? pillW(b.link, 32) : 0;
  const ox = 360, oy = Math.round(y0 + (lines.length - 1) * lh + 10);
  return `
<defs>
 <radialGradient id="g1" cx="50%" cy="85%" r="60%"><stop offset="0" stop-color="#2447e6" stop-opacity=".75"/><stop offset="1" stop-color="#2447e6" stop-opacity="0"/></radialGradient>
 <radialGradient id="g2" cx="12%" cy="10%" r="45%"><stop offset="0" stop-color="#2447e6" stop-opacity=".25"/><stop offset="1" stop-color="#2447e6" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1500" height="1000" fill="#08090c"/><rect width="1500" height="1000" fill="url(#g1)"/><rect width="1500" height="1000" fill="url(#g2)"/>
<image xlink:href="${asset(b.object, b.word)}" x="${ox}" y="${oy}" width="780" height="780"/>
${logo('#ffffff')}
<text font-family="Unbounded" font-weight="700" font-size="${fs_}" fill="#fff" text-anchor="middle" letter-spacing="-2">${tspans}</text>
${b.pill ? `<rect x="96" y="866" width="${pillW(b.pill, 30)}" height="72" rx="14" fill="${BLUE}"/><text x="${96 + pillW(b.pill, 30) / 2}" y="912" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="30" fill="#fff">${esc(b.pill)}</text>` : ''}
${b.link ? `<rect x="${1404 - lw}" y="860" width="${lw}" height="84" rx="42" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><text x="${1404 - lw / 2}" y="914" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="32" fill="#fff">${esc(b.link)}</text>` : ''}`;
}

export function bannerSvg(spec) {
  const b = normalizeBanner(spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1500" height="1000" viewBox="0 0 1500 1000">${b.layout === 'dark' ? dark(b) : light(b)}</svg>`;
}

export function renderBanner(spec) {
  const resvg = new Resvg(bannerSvg(spec), {
    fitTo: { mode: 'original' },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Montserrat' },
  });
  return resvg.render().asPng();
}
