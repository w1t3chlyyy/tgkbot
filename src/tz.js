// Работа с часовыми поясами без внешних библиотек.
function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  if (o.hour === '24') o.hour = '00';
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
}
function offsetMs(date, tz) {
  const p = partsIn(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}
/** Локальное время в поясе tz → Date (UTC) */
export function zonedToUtc(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  let utc = guess - offsetMs(new Date(guess), tz);
  utc = guess - offsetMs(new Date(utc), tz);
  return new Date(utc);
}
export const nowIn = (tz, now = new Date()) => partsIn(now, tz);
export function addDays(y, m, d, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
export function fmt(date, tz) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

/** «завтра 18:00», «сегодня 21.30», «30.10 12:00», «2026-11-02 09:15», «18:00» → Date | null */
export function parseWhen(text, tz, now = new Date()) {
  const s = text.toLowerCase().trim();
  const n = nowIn(tz, now);
  let m;
  if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})[ t]+(\d{1,2})[:.](\d{2})/))) return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
  if ((m = s.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s+(\d{1,2})[:.](\d{2})/))) {
    let y = m[3] ? +m[3] : n.y; if (y < 100) y += 2000;
    return zonedToUtc(y, +m[2], +m[1], +m[4], +m[5], tz);
  }
  if ((m = s.match(/(\d{1,2})[:.](\d{2})/))) {
    const off = /послезавтра/.test(s) ? 2 : /завтра/.test(s) ? 1 : 0;
    const dd = addDays(n.y, n.m, n.d, off);
    let when = zonedToUtc(dd.y, dd.m, dd.d, +m[1], +m[2], tz);
    if (!/сегодня|завтра/.test(s) && when <= now) { const d2 = addDays(n.y, n.m, n.d, 1); when = zonedToUtc(d2.y, d2.m, d2.d, +m[1], +m[2], tz); }
    return when;
  }
  return null;
}
export function presets(tz, now = new Date()) {
  const n = nowIn(tz, now);
  const t = addDays(n.y, n.m, n.d, 1);
  const list = [
    ['Через час', new Date(now.getTime() + 3600_000)],
    ['Сегодня 18:00', zonedToUtc(n.y, n.m, n.d, 18, 0, tz)],
    ['Завтра 12:00', zonedToUtc(t.y, t.m, t.d, 12, 0, tz)],
    ['Завтра 18:00', zonedToUtc(t.y, t.m, t.d, 18, 0, tz)],
  ];
  return list.filter(([, d]) => d > now);
}
