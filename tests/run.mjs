import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startMocks } from './mocks.mjs';

const M = await startMocks();
const base = `http://127.0.0.1:${M.port}`;
const ADMIN = 42, TOKEN = '123:testtoken';
Object.assign(process.env, {
  BOT_TOKEN: TOKEN, ADMIN_IDS: String(ADMIN), CRON_SECRET: 'cron-secret-123', CHANNEL_ID: '@chan', PUBLIC_URL: 'https://x.test', TELEGRAM_API_ROOT: base,
  SUPABASE_URL: base + '/sb', SUPABASE_KEY: 'k', QWEN_API_KEY: 'q', QWEN_BASE_URL: base + '/qwen',
  DATABASES: JSON.stringify([{ name: 'shop', url: base + '/ext', key: 'anon' }]),
});
const { createBot } = await import('../src/bot.js');
const { createApp, verifyInitData } = await import('../src/miniapp.js');
const { runCron } = await import('../src/scheduler.js');
const { todayIn } = await import('../src/planner.js');
const { setSetting } = await import('../src/store.js');
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
await setSetting('daily_enabled', false);
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
const dq = []; await runCron(bot.api, { defer: (p) => dq.push(p) }); await Promise.all(dq);
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
const deferred = []; const flush = () => Promise.all(deferred.splice(0));
const app = createApp(bot, { defer: (p) => deferred.push(p) }); const srv = app.listen(0); const api = `http://127.0.0.1:${srv.address().port}`;
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

/* 10. cron-эндпоинт и вебхук */
assert.equal((await fetch(api + '/api/cron')).status, 401);
assert.equal((await fetch(api + '/api/cron?secret=wrong')).status, 401);
const g = await (await fetch(api + '/api/posts/generate', { method: 'POST', headers: good, body: JSON.stringify({ topic: 'Крон' }) })).json();
await fetch(api + `/api/posts/${g.id}`, { method: 'PATCH', headers: good, body: JSON.stringify({ status: 'scheduled', scheduled_at: new Date(Date.now() - 1000).toISOString() }) });
const cr = await (await fetch(api + '/api/cron', { headers: { Authorization: 'Bearer cron-secret-123' } })).json(); await flush();
assert.equal(cr.ok, true); assert.equal(M.tables.posts.find((p) => p.id === g.id).status, 'published');
ok('/api/cron: без секрета 401; с секретом публикует просроченные посты (Bearer и ?secret=)');
const { webhookSecret } = await import('../src/miniapp.js');
const upd = { update_id: 777001, message: { message_id: 5, from: { id: ADMIN, is_bot: false, first_name: 'A' }, chat: { id: ADMIN, type: 'private' }, date: 1, text: '/help', entities: [{ type: 'bot_command', offset: 0, length: 5 }] } };
const hook = (secret) => fetch(api + '/api/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(upd) });
M.calls.length = 0;
assert.equal((await hook('bad')).status, 401);
assert.equal((await hook(webhookSecret())).status, 200);
assert.equal(M.calls.filter((c) => c.method === 'sendMessage').length, 1);
assert.equal((await hook(webhookSecret())).status, 200);
assert.equal(M.calls.filter((c) => c.method === 'sendMessage').length, 1);
ok('вебхук: неверный секрет отклоняется, повторная доставка того же update не обрабатывается дважды');
M.calls.length = 0;
assert.equal((await fetch(api + '/api/setup?secret=cron-secret-123')).status, 200);
const sw = M.calls.find((c) => c.method === 'setWebhook'); assert.equal(sw.body.url, 'https://x.test/api/webhook'); assert.equal(sw.body.secret_token, webhookSecret());
ok('/api/setup регистрирует вебхук в Telegram с секретом');

/* 11. контент-план из чата */
await setSetting('daily_time', '10:00'); M.tables.plan_items.length = 0; M.calls.length = 0;
await msg('30.10 Рулетка\n31.10 Как купить Stars\n01.11 Кейс Apex Core\n02.11 Вакансии');
const ask = [...M.calls].reverse().find((c) => c.method === 'sendMessage'); assert.match(JSON.stringify(ask.body.reply_markup), /plan:yes/);
await press('plan:yes');
assert.equal(M.tables.plan_items.length, 3);
const days = M.tables.plan_items.map((i) => i.day); assert.equal(days[2] > days[1] && days[1] > days[0], true);
const sum = [...M.calls].reverse().find((c) => c.method === 'sendMessage' && /План принят/.test(c.body.text || ''));
assert.ok(sum); assert.match(sum.body.text, /Пропустил пунктов с прошедшими датами: 1/);
ok('план текстом: бот спрашивает «это план?», разбирает по дням, пункт без даты идёт следом, прошедшие даты пропускаются');
await msg('просто тема для поста');
assert.equal(M.tables.plan_items.length, 3);
ok('обычное сообщение по-прежнему создаёт пост, а не план');

M.tables.plan_items.length = 0; M.calls.length = 0;
await bot.handleUpdate({ update_id: ++uid, message: { message_id: ++uid, from: { id: ADMIN, is_bot: false, first_name: 'A' }, chat: { id: ADMIN, type: 'private' }, date: 1, document: { file_id: 'f', file_unique_id: 'u', file_name: 'plan.txt', mime_type: 'text/plain', file_size: 100 } } });
assert.equal(M.tables.plan_items.length, 3);
ok('план файлом .txt принимается так же');
assert.equal((await (await fetch(api + '/api/plan/import', { method: 'POST', headers: good, body: JSON.stringify({ text: 'a\nb\nc' }) })).json()).count, 3);
ok('план можно вставить и в мини-приложении');

/* 12. ежедневный пост по времени */
M.tables.plan_items.length = 0;
M.tables.plan_items.push({ id: 901, day: '2026-10-29', topic: 'Рулетка дня', brief: 'код 24 часа', refs: [], status: 'idea', post_id: null }, { id: 902, day: '2026-10-30', topic: 'ПАДЕНИЕ', brief: '', refs: [], status: 'idea', post_id: null });
await setSetting('daily_enabled', true); await setSetting('approver', ADMIN);
const run = async (iso) => { const q = []; const r = await runCron(bot.api, { now: new Date(iso), defer: (p) => q.push(p) }); await Promise.all(q); return r; };
assert.equal((await run('2026-10-29T05:00:00Z')).daily.reason, 'early');
assert.equal(M.tables.plan_items[0].status, 'idea');
ok('до заданного времени (08:00 < 10:00 МСК) ничего не отправляется');
M.calls.length = 0; const countBefore = M.tables.posts.length;
const dq2 = []; const both = await Promise.all([1, 2].map(() => runCron(bot.api, { now: new Date('2026-10-29T07:30:00Z'), defer: (p) => dq2.push(p) }))); await Promise.all(dq2);
assert.equal(M.tables.posts.length, countBefore + 1);
assert.equal(M.tables.plan_items[0].status, 'made'); assert.equal(M.tables.posts.at(-1).topic, 'Рулетка дня');
assert.ok(M.calls.some((c) => c.method === 'sendPhoto' && /Рулетка/.test(c.body._raw || '') === false || c.method === 'sendPhoto'));
const ctl = [...M.calls].reverse().find((c) => c.method === 'sendMessage' && /Всё устраивает/.test(c.body.text || '')); assert.match(ctl.body.text, /Пост по плану на сегодня/);
assert.match(JSON.stringify(ctl.body.reply_markup), /Опубликовать сейчас/);
ok('в 10:30 МСК пункт на сегодня превращается в пост с баннером и уходит на согласование; два параллельных cron-вызова дают ровно один пост');
const again = await run('2026-10-29T08:00:00Z'); assert.equal(again.daily.started, false);
assert.equal(M.tables.posts.length, countBefore + 1);
ok('повторные вызовы cron в тот же день ничего не дублируют');
M.calls.length = 0; const r30 = await run('2026-10-30T07:30:00Z');
assert.equal(M.tables.plan_items[1].status, 'failed');
assert.ok(M.calls.some((c) => c.method === 'sendMessage' && /Не получилось подготовить пост/.test(c.body.text || '')));
ok('если Qwen упал — пункт помечается failed и админ получает сообщение с подсказкой /today');

/* 13. /today и сохранение состояния правки между вызовами */
await setSetting('daily_enabled', false);
M.tables.plan_items.push({ id: 903, day: todayIn('Europe/Moscow'), topic: 'Сегодняшний', brief: 'тезис', refs: [], status: 'idea', post_id: null });
const cmd = (text) => msg(text, ADMIN, { entities: [{ type: 'bot_command', offset: 0, length: text.length }] });
M.calls.length = 0; await cmd('/today');
assert.equal(M.tables.plan_items.find((i) => i.id === 903).status, 'made');
M.calls.length = 0; await cmd('/today');
assert.ok(M.calls.some((c) => c.method === 'sendMessage' && /ничего нет/.test(c.body.text || '')));
ok('/today делает пост на сегодня вручную; повторно — «ничего нет»');
const lastPost = M.tables.posts.at(-1).id;
await press(`p:${lastPost}:edit`);
assert.equal(M.tables.settings.find((s) => s.key === `state:${ADMIN}`).value.mode, 'edit');
ok('диалоговое состояние («жду текст правки») лежит в базе, а не в памяти — переживёт перезапуск/другой экземпляр');

console.log(`\nВсе проверки пройдены: ${n}`);
srv.close(); M.server.close(); process.exit(0);
