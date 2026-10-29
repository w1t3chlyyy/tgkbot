// Моки Telegram Bot API, Supabase (PostgREST) и Qwen для проверки всего потока без реальных ключей.
import http from 'node:http';

export function startMocks() {
  const calls = [];                       // все вызовы Telegram: {method, body}
  const qwenCalls = [];
  let mid = 100;
  const tables = { posts: [], settings: [], emoji: [], plan_items: [], processed_updates: [] };
  const seq = { posts: 0, plan_items: 0 };
  const ext = { products: [{ id: 1, name: 'Telegram Premium 3 мес', description: 'Подписка на 3 месяца', price: 1290, secret_token: 'LEAK' }], orders: [{ id: 1, name: 'order', card: '4111' }], promocodes: [{ id: 1, code: 'X' }] };

  const matches = (row, key, val) => {
    const [op, ...rest] = val.split('.'); const arg = rest.join('.');
    const v = row[key];
    if (op === 'eq') return String(v) === arg;
    if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').includes(String(v));
    if (op === 'lt') return v != null && String(v) < arg;
    if (op === 'lte') return v != null && String(v) <= arg;
    if (op === 'ilike') return String(v ?? '').toLowerCase().includes(decodeURIComponent(arg).replace(/\*/g, '').toLowerCase());
    return true;
  };
  function query(rows, params) {
    let out = rows.filter((r) => [...params.entries()].every(([k, v]) => ['select', 'order', 'limit', 'on_conflict'].includes(k) || matches(r, k, v)));
    const ord = params.get('order');
    if (ord) for (const part of ord.split(',').reverse()) { const [f, dir] = part.split('.'); out = [...out].sort((a, b) => (a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
    if (params.get('limit')) out = out.slice(0, +params.get('limit'));
    return out;
  }
  const defaults = { posts: () => ({ status: 'draft', topic: '', brief: '', refs: [], html: '', banner: {}, buttons: [], scheduled_at: null, published_at: null, preview: {}, history: [], error: null, created_at: new Date().toISOString() }), plan_items: () => ({ brief: '', refs: [], status: 'idea', post_id: null, created_at: new Date().toISOString() }) };

  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

    // ── файл Telegram (документ с планом) ──
    if (url.pathname.startsWith('/file/bot')) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('1. Рулетка промокодов\n2. Как купить Stars\n3. Кейс Apex Core\n4. Вакансии'); }

    // ── Telegram ──
    const tg = url.pathname.match(/^\/bot[^/]+\/(\w+)$/);
    if (tg) {
      const method = tg[1];
      let body = {}; const ct = req.headers['content-type'] || '';
      if (ct.includes('json')) body = JSON.parse(raw.toString() || '{}'); else body = { _raw: raw.toString('utf8') };
      calls.push({ method, body });
      const chat = { id: body.chat_id ?? 1, type: 'private', username: String(body.chat_id).startsWith('@') ? String(body.chat_id).slice(1) : undefined };
      if (method === 'getMe') return send(200, { ok: true, result: { id: 777, is_bot: true, first_name: 'T', username: 'testbot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false } });
      if (['sendMessage', 'sendPhoto', 'editMessageText', 'editMessageReplyMarkup'].includes(method)) return send(200, { ok: true, result: { message_id: ++mid, date: 1, chat, text: body.text } });
      if (method === 'getStickerSet') return send(200, { ok: true, result: { name: 'pack', title: 'Test Pack', sticker_type: 'custom_emoji', stickers: [{ custom_emoji_id: '5111', emoji: '🔥', type: 'custom_emoji' }, { custom_emoji_id: '5222', emoji: '🎰', type: 'custom_emoji' }] } });
      if (method === 'getFile') return send(200, { ok: true, result: { file_id: 'f', file_path: 'docs/plan.txt' } });
      if (method === 'getChat') return send(200, { ok: true, result: { id: -1001, type: 'channel', title: 'Chan' } });
      if (method === 'getChatMember') return send(200, { ok: true, result: { status: 'administrator', user: { id: 777 } } });
      return send(200, { ok: true, result: true });
    }

    // ── Qwen ──
    if (url.pathname === '/qwen/chat/completions') {
      const j = JSON.parse(raw.toString()); qwenCalls.push(j);
      const user = j.messages.at(-1).content;
      if (/ПАДЕНИЕ/.test(user)) return send(500, { error: 'boom' });
      let out;
      if (/парсер контент-планов/.test(j.messages[0].content)) {
        const today = user.match(/Сегодня: (\d{4}-\d{2}-\d{2})/)[1];
        const shift = (n) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
        out = { items: [{ day: shift(-1), topic: 'Старый пост', brief: '' }, { day: shift(0), topic: 'Рулетка', brief: 'код 24 часа' }, { day: shift(1), topic: 'Как купить Stars', brief: '3 шага' }, { day: null, topic: 'Кейс Apex', brief: 'ИИ-агенты' }] };
      } else if (/Составь контент-план/.test(user)) out = { items: [{ day: '2026-10-29', topic: 'Рулетка', brief: 'Код 24 часа' }, { day: '2026-10-30', topic: 'Как купить Stars', brief: '3 шага' }] };
      else if (/ПРАВКА ОТ РЕДАКТОРА/.test(user)) out = { html: '<b>Короткий пост</b> 🔥', banner: { headline: 'Коротко', pill: '', link: 'hustlify.site', object: 'cube', word: 'новинка', layout: 'dark' }, buttons: [{ text: 'Открыть', url: 'https://hustlify.site' }] };
      else out = { html: '<h1>Рулетка</h1><p>Крути & выигрывай 🎰 <script>x</script></p><b>Код живёт 24 часа</b> 🔥', banner: { headline: 'Крути рулетку и забирай скидку', pill: 'Промокод на 24 часа', link: 'hustlify.site', object: 'star', word: 'скидка', layout: 'light' }, buttons: [{ text: 'Крутить рулетку', url: 'https://hustlify.site' }, { text: 'Левая', url: 'https://evil.example/phish' }] };
      return send(200, { choices: [{ message: { content: JSON.stringify(out) } }] });
    }

    // ── PostgREST: /sb (своя БД) и /ext (внешняя БД сайта) ──
    const m = url.pathname.match(/^\/(sb|ext)\/rest\/v1\/?(\w*)$/);
    if (m) {
      const [, which, table] = m;
      if (!table) return send(200, { definitions: which === 'ext' ? { products: {}, orders: {}, promocodes: {} } : {} });
      const rows = which === 'ext' ? ext[table] : tables[table];
      if (!rows) return send(404, { message: 'no table' });
      const body = raw.length ? JSON.parse(raw.toString()) : null;
      if (req.method === 'GET') return send(200, query(rows, url.searchParams));
      if (which === 'ext') return send(403, {});
      if (req.method === 'POST') {
        const list = Array.isArray(body) ? body : [body]; const out = [];
        const oc = url.searchParams.get('on_conflict');
        for (const item of list) {
          if (oc) { const i = rows.findIndex((r) => r[oc] === item[oc]); if (i >= 0) { if (!(req.headers.prefer || '').includes('ignore-duplicates')) { Object.assign(rows[i], item); out.push(rows[i]); } continue; } }
          const row = { ...(defaults[table]?.() || {}), ...item }; if (table in seq) row.id = ++seq[table];
          rows.push(row); out.push(row);
        }
        return send(201, out);
      }
      if (req.method === 'PATCH') { const hit = query(rows, url.searchParams); hit.forEach((r) => Object.assign(r, body)); return send(200, hit); }
      if (req.method === 'DELETE') { const hit = new Set(query(rows, url.searchParams)); const keep = rows.filter((r) => !hit.has(r)); rows.length = 0; rows.push(...keep); return send(204, null); }
    }
    send(404, { error: 'not found ' + url.pathname });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, calls, qwenCalls, tables, server })));
}
