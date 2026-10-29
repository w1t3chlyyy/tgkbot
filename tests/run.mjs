import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startMocks } from './mocks.mjs';

const M = await startMocks();
const base = `http://127.0.0.1:${M.port}`;
const ADMIN = 42, TOKEN = '123:testtoken';
Object.assign(process.env, {
  BOT_TOKEN: TOKEN, ADMIN_IDS: String(ADMIN), CHANNEL_ID: '@chan', PUBLIC_URL: 'https://x.test', TELEGRAM_API_ROOT: base,
  SUPABASE_URL: base + '/sb', SUPABASE_KEY: 'k', QWEN_API_KEY: 'q', QWEN_BASE_URL: base + '/qwen',
  DATABASES: JSON.stringify([{ name: 'shop', url: base + '/ext', key: 'anon' }]),
});
const { createBot } = await import('../src/bot.js');
const { createApp, verifyInitData } = await import('../src/miniapp.js');
const { startScheduler } = await import('../src/scheduler.js');
const { sanitizeHtml, applyCustomEmoji } = await import('../src/html.js');
const { parseWhen, zonedToUtc } = await import('../src/tz.js');
const { listCatalog, materialFromRefs } = await import('../src/sources.js');
const { loadEmojiMap, saveEmojiPack } = await import('../src/store.js');
const { renderBanner } = await import('../src/banner.js');

let n = 0; const ok = (name) => console.log(`  ✓ ${++n}. ${name}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastCall = (method) => [...M.calls].reverse().find((c) => c.method === method);

/* 1. чистые модули */
assert.equal(sanitizeHtml('<h1>Hi</h1><p>a & b <script>x</script></p><i>u'), '<b>Hi</b>\n\na &amp; b x\n<i>u</i>');
ok('санитайзер: теги, амперсанды, незакрытые теги');
assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), 'x');
ok('санитайзер: опасные ссылки отбрасываются');
const t = zonedToUtc(2026, 10, 30, 18, 0, 'Europe/Moscow'); assert.equal(t.toISOString(), '2026-10-30T15:00:00.000Z');
assert.equal(parseWhen('30.10 18:00', 'Europe/Moscow', new Date('2026-10-28T10:00:00Z')).toISOString(), '2026-10-30T15:00:00.000Z');
assert.equal(parseWhen('завтра 12:30', 'Europe/Moscow', new Date('2026-10-28T10:00:00Z')).toISOString(), '2026-10-29T09:30:00.000Z');
assert.equal(parseWhen('абракадабра', 'Europe/Moscow'), null);
ok('часовые пояса и разбор «завтра 12:30» / «30.10 18:00»');
const png = renderBanner({ layout: 'dark', object: 'coin', word: 'конкурс', headline: 'Конкурс недели', pill: 'Старт', link: 'hustlify.site' });
assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.ok(png.length > 50_000);
ok('баннер рендерится в PNG на сервере (resvg)');

/* 2. источники: чувствительные таблицы скрыты */
const cat = await listCatalog();
assert.deepEqual(cat.map((c) => c.table), ['products']);
const mat = await materialFromRefs([{ db: 'shop', table: 'products', id: 1 }]);
assert.match(mat, /Telegram Premium 3 мес/); assert.ok(!/LEAK/.test(mat));
ok('автообнаружение таблиц: orders/promocodes скрыты, секретные колонки не уходят в Qwen');

/* 3. бот: сборка */
const bot = createBot(); await bot.init();
let uid = 0;
const msg = (text, from = ADMIN, extra = {}) => bot.handleUpdate({ update_id: ++uid, message: { message_id: ++uid, from: { id: from, is_bot: false, first_name: 'A' }, chat: { id: from, type: 'private' }, date: 1, text, ...extra } });
const press = (data, mId = 900) => bot.handleUpdate({ update_id: ++uid, callback_query: { id: String(uid), from: { id: ADMIN, is_bot: false, first_name: 'A' }, chat_instance: 'c', message: { message_id: mId, chat: { id: ADMIN, type: 'private' }, date: 1 }, data } });

await msg('/pack https://t.me/addemoji/pack', ADMIN, { entities: [{ type: 'bot_command', offset: 0, length: 5 }] });
assert.equal((await loadEmojiMap()).size, 2);
ok('/pack грузит пак премиум-эмодзи в базу');
assert.equal(await applyCustomEmoji('Привет 🔥 и 🎰 и 😀'), 'Привет <tg-emoji emoji-id="5111">🔥</tg-emoji> и <tg-emoji emoji-id="5222">🎰</tg-emoji> и 😀');
ok('обычные эмодзи заменяются на премиум по совпадению');

await msg('Рулетка промокодов\nкод одноразовый, живёт 24 часа', 99);
assert.equal(M.calls.filter((c) => c.method === 'sendPhoto').length, 0);
ok('чужим пользователям бот не отвечает постами');

M.calls.length = 0;
await msg('Рулетка промокодов\nкод одноразовый, живёт 24 часа');
const photo = lastCall('sendPhoto'); assert.ok(photo, 'превью с баннером не отправлено');
assert.match(photo.body._raw, /tg-emoji emoji-id="5111"/); assert.match(photo.body._raw, /Код живёт 24 часа/);
assert.ok(!/script|<h1>/.test(photo.body._raw));
const ctrl = lastCall('sendMessage'); assert.match(ctrl.body.text, /Всё устраивает/);
const btns = JSON.stringify(ctrl.body.reply_markup); assert.match(btns, /Опубликовать сейчас/); assert.match(btns, /Править текст/); assert.match(btns, /Баннер/);
const p1 = M.tables.posts[0]; assert.equal(p1.status, 'draft'); assert.equal(p1.buttons.length, 1);
ok('тема в чат → пост с баннером и премиум-эмодзи приходит на согласование с кнопками; чужая ссылка в кнопках отброшена');
assert.ok(M.qwenCalls[0].messages[0].content.includes('🔥 🎰'));
ok('Qwen получает список эмодзи из пака');

/* 4. правка */
M.calls.length = 0;
await press('p:1:edit'); await msg('сделай короче, баннер тёмный');
assert.match(M.tables.posts[0].html, /Короткий пост/); assert.equal(M.tables.posts[0].banner.layout, 'dark');
assert.ok(lastCall('sendPhoto'), 'после правки пост не показан заново');
ok('«Править» → инструкция → Qwen правит → новый черновик на согласование');

/* 5. кнопки баннера */
const before = M.tables.posts[0].banner.object;
await press('p:1:bo'); assert.notEqual(M.tables.posts[0].banner.object, before);
await press('p:1:bh'); await msg('Новый заголовок'); assert.equal(M.tables.posts[0].banner.headline, 'Новый заголовок');
ok('баннер: смена объекта и заголовка вручную');

/* 6. планирование пресетом и своё время */
await press('p:1:sched'); // меню времени
const when = Math.floor(Date.now() / 1000) + 3600;
await press(`p:1:t:${when}`);
assert.equal(M.tables.posts[0].status, 'scheduled'); assert.equal(Date.parse(M.tables.posts[0].scheduled_at) / 1000, when);
ok('«Запланировать» → статус scheduled');
await press('p:1:unsched'); assert.equal(M.tables.posts[0].status, 'draft');
await press('p:1:tc'); await msg('завтра 18:30');
assert.equal(M.tables.posts[0].status, 'scheduled');
ok('своё время текстом: «завтра 18:30»');

/* 7. планировщик публикует просроченный пост */
M.tables.posts[0].scheduled_at = new Date(Date.now() - 1000).toISOString();
M.calls.length = 0;
startScheduler(bot.api, 3_600_000); await sleep(800);
assert.equal(M.tables.posts[0].status, 'published');
const chanSend = M.calls.find((c) => c.method === 'sendPhoto' && String(c.body._raw).includes('@chan'));
assert.ok(chanSend, 'в канал не отправлено');
ok('планировщик публикует в канал по времени и уведомляет админа');

/* 8. публикация сразу + защита от дубля */
await msg('Как купить Stars\n3 шага');
const id2 = M.tables.posts[1].id; M.calls.length = 0;
await press(`p:${id2}:pub`); assert.equal(M.tables.posts[1].status, 'published');
M.calls.length = 0; await press(`p:${id2}:pub`);
assert.equal(M.calls.filter((c) => c.method === 'sendPhoto').length, 0);
ok('«Опубликовать сейчас» работает один раз, повторное нажатие не дублирует');

/* 9. мини-приложение */
const app = createApp(bot.api); const srv = app.listen(0); const api = `http://127.0.0.1:${srv.address().port}`;
const sign = (user, age = 0) => { const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), user: JSON.stringify(user), query_id: 'q' }); const data = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n'); const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest(); p.set('hash', crypto.createHmac('sha256', secret).update(data).digest('hex')); return p.toString(); };
const H = (init) => ({ 'Content-Type': 'application/json', 'X-Init-Data': init });
assert.equal((await fetch(api + '/api/bootstrap')).status, 401);
assert.equal((await fetch(api + '/api/bootstrap', { headers: H(sign({ id: 99 })) })).status, 401);
assert.equal((await fetch(api + '/api/bootstrap', { headers: H(sign({ id: ADMIN }, 999999)) })).status, 401);
const forged = sign({ id: ADMIN }).replace(/hash=[0-9a-f]{6}/, 'hash=000000'); assert.equal((await fetch(api + '/api/bootstrap', { headers: H(forged) })).status, 401);
const good = H(sign({ id: ADMIN }));
const boot = await (await fetch(api + '/api/bootstrap', { headers: good })).json();
assert.equal(boot.user.id, ADMIN); assert.equal(boot.emojiCount, 2); assert.equal(boot.sources.length, 1);
ok('мини-приложение: подпись initData проверяется (чужой, просроченный и подделанный отклоняются)');
const rows = await (await fetch(api + '/api/sources/rows?db=shop&table=products&q=Premium', { headers: good })).json();
assert.equal(rows[0].label, 'Telegram Premium 3 мес');
assert.equal((await fetch(api + '/api/sources/rows?db=shop&table=orders', { headers: good })).status, 400);
ok('поиск по базе сайта работает, скрытые таблицы недоступны');
const bimg = Buffer.from(await (await fetch(api + '/api/banner', { method: 'POST', headers: good, body: JSON.stringify({ spec: { layout: 'light', headline: 'Тест' } }) })).arrayBuffer());
assert.equal(bimg.subarray(1, 4).toString(), 'PNG');
ok('предпросмотр баннера отдаёт PNG');
M.calls.length = 0;
const gen = await (await fetch(api + '/api/posts/generate', { method: 'POST', headers: good, body: JSON.stringify({ topic: 'Премиум', refs: [{ db: 'shop', table: 'products', id: 1 }], banner: { layout: 'dark', word: 'новинка' }, scheduleLocal: '2026-11-02T18:00' }) })).json();
const gp = M.tables.posts.find((p) => p.id === gen.id);
assert.equal(gp.banner.layout, 'dark'); assert.equal(gp.banner.word, 'новинка'); assert.equal(gp.scheduled_at, '2026-11-02T15:00:00.000Z');
assert.ok(lastCall('sendPhoto') && lastCall('sendMessage'));
assert.match(M.qwenCalls.at(-1).messages.at(-1).content, /Telegram Premium 3 мес/);
ok('мини-приложение → пост с материалом из БД, ручной баннер приоритетнее Qwen, время по плану, карточка ушла в чат');
const pl = await (await fetch(api + '/api/plan/generate', { method: 'POST', headers: good, body: JSON.stringify({ days: 2 }) })).json();
assert.equal(pl.length, 2);
const made = await (await fetch(api + `/api/plan/${pl[0].id}/make`, { method: 'POST', headers: good, body: '{}' })).json();
assert.equal(M.tables.plan_items.find((i) => i.id === pl[0].id).status, 'made');
assert.equal(M.tables.posts.find((p) => p.id === made.id).scheduled_at, '2026-10-29T15:00:00.000Z');
ok('контент-план: генерация → «Сделать пост» ставит время по плану (18:00 МСК) и шлёт на согласование');

console.log(`\nВсе проверки пройдены: ${n}`);
srv.close(); M.server.close(); process.exit(0);
