const tg = window.Telegram?.WebApp; tg?.ready(); tg?.expand();
tg?.setHeaderColor?.('#08090c'); tg?.setBackgroundColor?.('#08090c');
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let boot = null, tab = 'plan';
const form = { topic: '', brief: '', refs: [], layout: '', object: '', word: '', srcKey: '', q: '', rows: [] };

async function api(path, { method = 'GET', body, blob } = {}) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Init-Data': tg?.initData || '' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return blob ? r.blob() : r.json();
}
let tt; function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => (t.className = ''), 2800); }
async function run(btn, fn) { if (btn) btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, true); } finally { if (btn) btn.disabled = false; } }

const TITLES = { plan: 'Контент-план', new: 'Новый пост', queue: 'Посты', settings: 'Настройки' };
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
function go(t) { tab = t; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); $('#title').textContent = TITLES[t]; ({ queue: renderQueue, new: renderNew, plan: renderPlan, settings: renderSettings })[t](); }

const STATUS = { draft: 'в чате', scheduled: 'в плане', published: 'опубликован', failed: 'ошибка', cancelled: 'убран', publishing: 'публикуется' };
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* ── Посты (уже сделанные) ── */
async function renderQueue() {
  view.innerHTML = '<div class="muted pad">Загрузка…</div>';
  const list = await api('/posts');
  if (!list.length) { view.innerHTML = '<div class="card muted">Пока пусто. Выбери пункт во вкладке «План» или создай пост во вкладке «Новый пост».</div>'; return; }
  view.innerHTML = list.map((p) => `<div class="card" data-id="${p.id}">
    <img class="thumb" data-spec='${esc(JSON.stringify(p.banner))}' alt="">
    <div class="row"><span class="badge ${p.status}">${STATUS[p.status] || p.status}</span><span class="muted small grow">#${p.id}</span></div>
    <div class="excerpt">${esc(plain(p.html))}</div>
    ${p.error ? `<div class="small" style="color:var(--red)">${esc(p.error)}</div>` : ''}
    <div class="row"><button class="b s" data-a="chat">Прислать в чат</button><button class="b s d" data-a="del">Удалить</button></div></div>`).join('');
  view.querySelectorAll('.thumb').forEach(async (img) => { try { img.src = URL.createObjectURL(await api('/banner', { method: 'POST', body: { spec: JSON.parse(img.dataset.spec) }, blob: true })); } catch { img.remove(); } });
  view.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => run(b, async () => {
    const id = b.closest('.card').dataset.id, a = b.dataset.a;
    if (a === 'chat') { await api(`/posts/${id}/chat`, { method: 'POST' }); toast('Прислал в чат'); }
    if (a === 'del') { if (!confirm('Удалить пост?')) return; await api(`/posts/${id}`, { method: 'DELETE' }); renderQueue(); }
  })));
}

/* ── Новый пост ── */
function renderNew() {
  const o = boot.options, srcs = boot.sources.filter((s) => s.table);
  view.innerHTML = `
  <h2>Что делаем?</h2>
  <label>Тема</label><input id="topic" placeholder="Например: рулетка промокодов" value="${esc(form.topic)}">
  <label>Тезисы (необязательно)</label><textarea id="brief" placeholder="Что важно сказать. Qwen не будет выдумывать цифры.">${esc(form.brief)}</textarea>
  <label>Материал из баз (каталог, кейсы, партнёры, проекты, портфолио…)</label>
  <div id="chips">${form.refs.map((r, i) => `<span class="chip">${esc(r.label)}<button data-rm="${i}">✕</button></span>`).join('')}</div>
  ${srcs.length ? `<div class="row"><select id="src" class="grow"><option value="">Выбери таблицу…</option>${srcs.map((s) => `<option value="${s.db}|${s.table}" ${form.srcKey === s.db + '|' + s.table ? 'selected' : ''}>${esc(s.db)} · ${esc(s.table)}</option>`).join('')}</select></div>
  <div class="row nw" style="margin-top:8px"><input id="q" class="grow" placeholder="Поиск по названию" value="${esc(form.q)}"><button class="b g" id="find">Найти</button></div>
  <div id="rows">${form.rows.map((r) => `<div class="src"><div class="t"><b>${esc(r.label)}</b><span class="muted small">${esc(r.preview).slice(0, 70)}</span></div><button class="b s" data-add="${esc(r.id)}">+</button></div>`).join('')}</div>`
    : '<div class="muted small">Базы не подключены: добавь DATABASES в .env.</div>'}
  <label>Баннер</label>
  <div class="row"><select id="layout" class="grow"><option value="">Фон: авто</option>${Object.entries(o.layouts).map(([k, v]) => `<option value="${k}" ${form.layout === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
  <div class="row" style="margin-top:8px"><select id="object" class="grow"><option value="">Иконка: авто</option>${Object.entries(o.objects).map(([k, v]) => `<option value="${k}" ${form.object === k ? 'selected' : ''}>${k} — ${esc(v)}</option>`).join('')}</select></div>
  <div style="height:16px"></div>
  <button class="b grow" style="width:100%" id="go">Сделать пост и прислать в чат</button>
  <div class="muted small" style="margin-top:10px">Бот пришлёт фото и пост (с форматированием), а под ним текст кнопок «Название - Ссылка».</div>`;
  const save = () => { form.topic = $('#topic').value; form.brief = $('#brief').value; form.layout = $('#layout').value; form.object = $('#object').value; if ($('#src')) { form.srcKey = $('#src').value; form.q = $('#q').value; } };
  view.querySelectorAll('input,textarea,select').forEach((e) => e.addEventListener('change', save));
  view.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { save(); form.refs.splice(+b.dataset.rm, 1); renderNew(); }));
  view.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { save(); const r = form.rows.find((x) => String(x.id) === b.dataset.add); const [db, table] = form.srcKey.split('|'); form.refs.push({ db, table, id: r.id, label: r.label }); renderNew(); }));
  $('#find')?.addEventListener('click', (e) => run(e.target, async () => { save(); if (!form.srcKey) return toast('Выбери таблицу', true); const [db, table] = form.srcKey.split('|'); form.rows = await api(`/sources/rows?db=${encodeURIComponent(db)}&table=${encodeURIComponent(table)}&q=${encodeURIComponent(form.q)}`); renderNew(); }));
  $('#src')?.addEventListener('change', () => { save(); form.rows = []; $('#find').click(); });
  $('#go').onclick = (e) => run(e.target, async () => {
    save(); if (!form.topic.trim()) return toast('Укажи тему', true);
    e.target.textContent = 'Пишу пост…';
    try {
      await api('/posts/generate', { method: 'POST', body: { topic: form.topic, brief: form.brief, refs: form.refs.map(({ db, table, id }) => ({ db, table, id })), banner: { layout: form.layout, object: form.object, word: form.word } } });
    } finally { e.target.textContent = 'Сделать пост и прислать в чат'; }
    Object.assign(form, { topic: '', brief: '', refs: [], rows: [] });
    toast('Готово! Пост в чате с ботом'); setTimeout(() => tg?.close?.(), 1400);
  });
}

/* ── План: выбираешь пункт — бот делает пост сейчас ── */
async function renderPlan() {
  view.innerHTML = '<div class="muted pad">Загрузка…</div>';
  const items = await api('/plan');
  const s = boot.settings;
  const mode = s.dailyEnabled ? `Авто-режим включён: каждый день в ${esc(s.dailyTime)} бот сам делает пост на сегодня (выключается в «Настройках»).` : 'Нажми «Сделать сейчас» у нужного пункта: бот пришлёт в чат фото и пост.';
  const label = { made: 'пост сделан', skipped: 'пропущен', failed: 'ошибка', making: 'готовлю…' };
  view.innerHTML = `${items.map((i) => `<div class="card" data-id="${i.id}"><div class="row"><span class="badge ${i.status === 'made' ? 'published' : i.status === 'failed' ? 'failed' : ''}">${label[i.status] || 'ждёт'}</span><span class="muted small">${esc(i.day)}</span></div>
      <div style="font-weight:700;margin:8px 0 4px">${esc(i.topic)}</div><div class="excerpt">${esc(i.brief)}</div>
      <div class="row"><button class="b s w" data-a="make">${i.status === 'made' ? 'Сделать заново' : 'Сделать сейчас'}</button><button class="b s d" data-a="del">Убрать</button></div></div>`).join('') || '<div class="card muted">План пуст. Вставь план ниже или пришли его боту.</div>'}
    <div class="card"><b>Загрузить свой план</b>
    <div class="muted small" style="margin:4px 0 8px">Вставь текст: по строке или абзацу на пост, с датами или без. ${mode}</div>
    <textarea id="plantext" placeholder="30.10 — Рулетка промокодов&#10;31.10 — Как купить Stars: 3 шага&#10;01.11 — Кейс Apex Core…"></textarea>
    <div style="height:10px"></div><button class="b" style="width:100%" id="imp">Разобрать и сохранить</button></div>
    <div class="card"><b>…или сгенерировать план по базам</b>
    <div class="row" style="margin-top:8px"><input id="days" type="number" min="1" max="31" value="14" style="width:90px"><input id="focus" class="grow" placeholder="Фокус (необязательно): запуск конкурса, найм…"></div>
    <div style="height:10px"></div><button class="b" style="width:100%" id="gen">Составить план</button></div>`;
  $('#imp').onclick = (e) => run(e.target, async () => { e.target.textContent = 'Разбираю…'; try { const r = await api('/plan/import', { method: 'POST', body: { text: $('#plantext').value } }); toast(`Принято постов: ${r.count}`); } finally { e.target.textContent = 'Разобрать и сохранить'; } renderPlan(); });
  $('#gen').onclick = (e) => run(e.target, async () => { e.target.textContent = 'Думаю…'; try { await api('/plan/generate', { method: 'POST', body: { days: +$('#days').value, focus: $('#focus').value } }); } finally { e.target.textContent = 'Составить план'; } renderPlan(); });
  view.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => run(b, async () => {
    const id = b.closest('.card').dataset.id;
    if (b.dataset.a === 'make') {
      b.textContent = 'Пишу…';
      try {
        const r = await api(`/plan/${id}/make`, { method: 'POST', body: {} });
        toast(r?.sentToChat === false ? 'Пост сделан (не удалось отправить в чат)' : 'Пост в чате с ботом');
      } finally {
        b.textContent = 'Сделать сейчас';
      }
      renderPlan();
    }
    else { await api(`/plan/${id}`, { method: 'DELETE' }); renderPlan(); }
  })));
}

/* ── Настройки ── */
function renderSettings() {
  const s = boot.settings;
  view.innerHTML = `<div class="card">
    <label style="margin-top:0">Часовой пояс</label><input id="tz" value="${esc(s.tz)}">
    <div class="row"><div class="grow"><label>Авто-режим: делать пост на сегодня в</label><input id="daily" value="${esc(s.dailyTime)}"></div><div class="sw" style="padding-top:26px"><span>Авто</span><input type="checkbox" id="de" ${s.dailyEnabled ? 'checked' : ''}></div></div>
    <div class="sw"><span>Премиум-эмодзи <span class="muted small">(в паке: ${boot.emojiCount})</span></span><input type="checkbox" id="ce" ${s.customEmoji ? 'checked' : ''}></div>
    <label>Пак премиум-эмодзи</label><div class="row"><input id="pack" class="grow" placeholder="t.me/addemoji/…"><button class="b g" id="loadpack">Загрузить</button></div>
    <label>Ссылки для кнопок (JSON)</label><textarea id="links">${esc(JSON.stringify(s.links, null, 2))}</textarea>
    <label>Стиль-промпт для Qwen</label><textarea id="style" style="min-height:200px">${esc(s.stylePrompt)}</textarea>
    <div style="height:12px"></div><button class="b" style="width:100%" id="save">Сохранить</button></div>`;
  $('#save').onclick = (e) => run(e.target, async () => {
    let links; try { links = JSON.parse($('#links').value); } catch { throw new Error('Ссылки: некорректный JSON'); }
    await api('/settings', { method: 'PUT', body: { tz: $('#tz').value, dailyTime: $('#daily').value, dailyEnabled: $('#de').checked, customEmoji: $('#ce').checked, stylePrompt: $('#style').value, links } });
    boot = await api('/bootstrap'); toast('Сохранено');
  });
  $('#loadpack').onclick = (e) => run(e.target, async () => { const r = await api('/emoji/pack', { method: 'POST', body: { name: $('#pack').value } }); boot = await api('/bootstrap'); toast(`Загружено эмодзи: ${r.count}`); renderSettings(); });
}

(async () => { try { boot = await api('/bootstrap'); go('plan'); } catch (e) { view.innerHTML = `<div class="card">Нет доступа или сервер недоступен.<div class="muted small" style="margin-top:6px">${esc(e.message)}</div></div>`; } })();
