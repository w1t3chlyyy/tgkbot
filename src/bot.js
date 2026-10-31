import { Bot, InlineKeyboard } from 'grammy';
import { cfg } from './config.js';
import { posts, plan, getRuntime, setSetting, getSetting, saveEmojiPack, loadEmojiMap, getState, setState, clearState } from './store.js';
import { generatePost, revisePost } from './post.js';
import { normalizeBanner } from './banner.js';
import { showDraft, controlText, menuKeyboard, cycle, OBJECTS, WORDS, LAYOUTS } from './draft.js';
import { publishPost } from './publisher.js';
import { parseWhen, fmt } from './tz.js';
import { DEFAULT_STYLE } from './prompts.js';
import { parsePlan, savePlan, makeToday, todayIn } from './planner.js';

const HELP = `<b>Hustlify · студия постов</b>

<b>Контент-план.</b> Пришли мне план текстом (или файлом .txt): по строке или абзацу на пост, с датами или без. Дальше каждый день в заданное время я сам подготовлю пост с баннером и кнопками и пришлю его тебе на согласование.

<b>Отдельный пост.</b> Напиши тему (с новой строки — тезисы), и я пришлю черновик.

<b>Команды</b>
/plan — план и статусы · /today — сделать пост на сегодня сейчас
/dailytime <i>10:30</i> — во сколько присылать · /daily on|off — включить/выключить
/planclear — удалить ещё не сделанные пункты
/studio — мини-приложение · /queue — очередь публикаций
/pack <i>ссылка</i> — пак премиум-эмодзи · /emoji on|off
/channel <i>@канал</i> — куда публиковать · /prompt — стиль-промпт
/cancel — сбросить текущее действие`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ddmm = (ymd) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
const STATUS_ICON = { idea: '🕐', making: '⏳', made: '✅', failed: '⚠️', skipped: '⏭' };

/** Похоже ли сообщение на контент-план (несколько строк с датами/«День N»/нумерацией). */
export function looksLikePlan(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return false;
  const marked = lines.filter((l) => /(^|\s)(\d{1,2}[./]\d{1,2}(?![\d:])|день\s*\d+|пост\s*\d+|\d{1,2}\s*[.)]\s)/i.test(l)).length;
  return marked >= 3 || /^\s*(контент[- ]?план|план)\b/i.test(lines[0]);
}

export function createBot() {
  const bot = new Bot(cfg.botToken, cfg.tgApiRoot ? { client: { apiRoot: cfg.tgApiRoot } } : undefined);

  bot.use(async (ctx, next) => {
    if (!ctx.from || !cfg.adminIds.has(ctx.from.id)) {
      if (ctx.chat?.type === 'private') await ctx.reply('Это приватный бот команды Hustlify.');
      return;
    }
    await next();
  });

  const appKb = () => (cfg.publicUrl.startsWith('https://') ? new InlineKeyboard().webApp('📱 Открыть студию', cfg.publicUrl + '/app/') : undefined);

  async function newFromText(ctx, text) {
    const chatId = ctx.chat.id;
    const [topic, ...rest] = text.trim().split('\n');
    const wait = await ctx.reply('⏳ Пишу пост и рисую баннер…');
    try {
      const gen = await generatePost({ topic: topic.trim(), brief: rest.join('\n').trim() });
      const post = await posts.create({ status: 'draft', topic: topic.trim().slice(0, 200), brief: rest.join('\n').trim(), html: gen.html, banner: gen.banner, buttons: gen.buttons, admin_chat_id: chatId });
      await ctx.api.deleteMessage(chatId, wait.message_id).catch(() => {});
      return showDraft(ctx.api, chatId, post.id);
    } catch (e) {
      await ctx.api.deleteMessage(chatId, wait.message_id).catch(() => {});
      throw e;
    }
  }

  async function importPlan(ctx, text) {
    const rt = await getRuntime();
    const wait = await ctx.reply('⏳ Разбираю план…');
    try {
      const { items, skippedPast } = await parsePlan(text, { tz: rt.tz, dailyTime: rt.dailyTime });
      if (!items.length) throw new Error('Все даты в плане уже прошли.');
      await savePlan(items);
      await setSetting('approver', ctx.chat.id); // согласовывать будет тот, кто прислал план
      const list = items.slice(0, 25).map((i) => `${ddmm(i.day)} — ${esc(i.topic)}`).join('\n');
      await ctx.api.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {});
      return ctx.reply(`✅ <b>План принят: ${items.length} пост(ов)</b>, ${ddmm(items[0].day)} → ${ddmm(items.at(-1).day)}\n\n${list}${items.length > 25 ? '\n…' : ''}${skippedPast ? `\n\nПропустил пунктов с прошедшими датами: ${skippedPast}` : ''}\n\nКаждый день в <b>${rt.dailyTime}</b> (${rt.tz}) пришлю пост на согласование. ${rt.dailyEnabled ? '' : '\n⚠️ Сейчас авто-режим выключен: /daily on'}\nПост на сегодня прямо сейчас: /today · изменить время: /dailytime 11:00`, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.api.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {});
      throw e;
    }
  }

  bot.command('start', (ctx) => ctx.reply(HELP, { parse_mode: 'HTML', reply_markup: appKb() }));
  bot.command('help', (ctx) => ctx.reply(HELP, { parse_mode: 'HTML', reply_markup: appKb() }));
  bot.command('studio', (ctx) => ctx.reply(appKb() ? 'Мини-приложение:' : 'Не знаю адрес сервиса: задай PUBLIC_URL (https://…)', { reply_markup: appKb() }));
  bot.command('cancel', async (ctx) => { await clearState(ctx.chat.id); return ctx.reply('Ок, сбросил.'); });

  bot.command('queue', async (ctx) => {
    const rt = await getRuntime();
    const list = await posts.list('scheduled');
    if (!list.length) return ctx.reply('Очередь пуста.');
    list.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    return ctx.reply(list.map((p) => `#${p.id} · ${fmt(p.scheduled_at, rt.tz)} — ${p.topic || p.html.replace(/<[^>]+>/g, '').slice(0, 50)}`).join('\n'));
  });

  /* ── контент-план ── */
  bot.command('plan', async (ctx) => {
    const rt = await getRuntime();
    const today = todayIn(rt.tz);
    const items = (await plan.list()).filter((i) => i.day >= today || i.status === 'failed');
    if (!items.length) { await setState(ctx.chat.id, { mode: 'plan_wait' }); return ctx.reply('Плана пока нет. Пришли его следующим сообщением (или файлом .txt): по строке или абзацу на пост, с датами или без.'); }
    const lines = items.slice(0, 30).map((i) => `${STATUS_ICON[i.status] || '•'} ${ddmm(i.day)} — ${esc(i.topic)}`).join('\n');
    return ctx.reply(`<b>План</b> (${rt.dailyEnabled ? `каждый день в ${rt.dailyTime}` : 'авто-режим выключен'}, ${rt.tz})\n\n${lines}${items.length > 30 ? '\n…' : ''}\n\n🕐 ждёт · ⏳ готовлю · ✅ прислал на согласование · ⚠️ ошибка (/today)\nЗаменить план — просто пришли новый.`, { parse_mode: 'HTML' });
  });
  bot.command('planclear', async (ctx) => { await plan.clearAllOpen(); return ctx.reply('Удалил все ещё не сделанные пункты плана.'); });
  bot.command('today', async (ctx) => {
    const wait = await ctx.reply('⏳ Готовлю пост на сегодня…');
    try {
      const post = await makeToday(ctx.api);
      await ctx.api.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {});
      if (!post) return ctx.reply('На сегодня в плане ничего нет (или пост уже готовился). Посмотреть план: /plan');
    } catch (e) { await ctx.api.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {}); /* текст ошибки уже отправлен из planner */ }
  });
  bot.command('dailytime', async (ctx) => {
    const v = ctx.match?.trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(v || '')) return ctx.reply(`Сейчас: ${(await getRuntime()).dailyTime}. Изменить: /dailytime 10:30`);
    const t = v.padStart(5, '0');
    await setSetting('daily_time', t);
    return ctx.reply(`✅ Буду присылать пост на согласование каждый день в ${t}.`);
  });
  bot.command('daily', async (ctx) => {
    const a = ctx.match?.trim().toLowerCase();
    if (a !== 'on' && a !== 'off') return ctx.reply(`Авто-режим: ${(await getRuntime()).dailyEnabled ? 'включён' : 'выключен'}. /daily on или /daily off`);
    await setSetting('daily_enabled', a === 'on');
    return ctx.reply(`Авто-режим ежедневных постов ${a === 'on' ? 'включён' : 'выключен'}.`);
  });

  bot.command('channel', async (ctx) => {
    const v = ctx.match?.trim();
    if (!v) return ctx.reply(`Сейчас: ${(await getRuntime()).channel || 'не задан'}\nИзменить: /channel @username или /channel -100…\nБот должен быть админом канала с правом публикации.`);
    try {
      const chat = await ctx.api.getChat(v);
      const me = await ctx.api.getChatMember(chat.id, ctx.me.id);
      if (!['administrator', 'creator'].includes(me.status)) return ctx.reply('Бот в этом канале не админ. Добавь его с правом «Публикация сообщений».');
      await setSetting('channel', v);
      return ctx.reply(`✅ Канал: ${chat.title || v}`);
    } catch (e) { return ctx.reply('Не получилось проверить канал: ' + e.message); }
  });

  bot.command('emoji', async (ctx) => {
    const a = ctx.match?.trim().toLowerCase();
    if (a === 'on' || a === 'off') { await setSetting('custom_emoji', a === 'on'); return ctx.reply(`Премиум-эмодзи: ${a === 'on' ? 'включены' : 'выключены'}`); }
    const map = await loadEmojiMap();
    return ctx.reply(`В паке: ${map.size} эмодзи. Статус: ${(await getRuntime()).customEmoji ? 'включены' : 'выключены'}.\n/pack <ссылка на пак> — загрузить; /emoji on|off — переключить.`);
  });

  bot.command('pack', async (ctx) => {
    const raw = ctx.match?.trim();
    if (!raw) return ctx.reply('Пришли ссылку на пак: /pack https://t.me/addemoji/НазваниеПака');
    const name = raw.replace(/^https?:\/\/t\.me\/addemoji\//i, '').replace(/[/?#].*$/, '');
    try {
      const set = await ctx.api.getStickerSet(name);
      if (set.sticker_type !== 'custom_emoji') return ctx.reply('Это обычный стикерпак, а нужен пак эмодзи (ссылка вида t.me/addemoji/…).');
      const n = await saveEmojiPack(name, set.stickers);
      return ctx.reply(`✅ Загружено эмодзи: ${n} из «${set.title}».\nОни подставляются по совпадению с обычным эмодзи (🔥 → 🔥 из пака). Включить/выключить: /emoji on|off.`);
    } catch (e) { return ctx.reply('Не получилось загрузить пак: ' + e.message); }
  });

  bot.command('prompt', async (ctx) => {
    const cur = (await getSetting('style_prompt')) || DEFAULT_STYLE;
    await setState(ctx.chat.id, { mode: 'setprompt' });
    return ctx.reply(`Текущий стиль-промпт:\n\n${cur.slice(0, 1500)}\n\nПришли новый одним сообщением, чтобы заменить (или /cancel).`);
  });

  /* ── файл с планом (.txt/.md/.csv) ── */
  bot.on('message:document', async (ctx) => {
    const d = ctx.message.document;
    if (!/\.(txt|md|csv)$/i.test(d.file_name || '') && !/^text\//.test(d.mime_type || '')) return ctx.reply('Пришли план текстом или файлом .txt / .md / .csv.');
    if ((d.file_size || 0) > 300_000) return ctx.reply('Файл слишком большой (лимит 300 КБ).');
    try {
      const f = await ctx.api.getFile(d.file_id);
      const r = await fetch(`${cfg.tgApiRoot || 'https://api.telegram.org'}/file/bot${cfg.botToken}/${f.file_path}`);
      if (!r.ok) throw new Error('Не смог скачать файл');
      return await importPlan(ctx, await r.text());
    } catch (e) { return ctx.reply('⚠️ ' + e.message); }
  });

  /* ── подтверждение «это контент-план?» ── */
  bot.callbackQuery(/^plan:(yes|no)$/, async (ctx) => {
    const chatId = ctx.chat?.id ?? ctx.from.id;
    const st = await getState(chatId);
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    if (st?.mode !== 'plan_pending') return ctx.reply('Не нашёл текст плана. Пришли его ещё раз.');
    await clearState(chatId);
    const fake = { chat: { id: chatId }, api: ctx.api, reply: (t, o) => ctx.api.sendMessage(chatId, t, o) };
    try {
      return ctx.match[1] === 'yes' ? await importPlan(fake, st.text) : await newFromText(fake, st.text);
    } catch (e) { return ctx.api.sendMessage(chatId, '⚠️ ' + e.message); }
  });

  /* ── кнопки под карточкой согласования ── */
  bot.callbackQuery(/^p:(\d+):(\w+)(?::(.+))?$/, async (ctx) => {
    const [, idStr, act, arg] = ctx.match;
    const id = Number(idStr);
    const chatId = ctx.chat?.id ?? ctx.from.id;
    try {
      let post = await posts.get(id);
      if (!post) return ctx.answerCallbackQuery({ text: 'Пост не найден', show_alert: true });
      const rt = await getRuntime();
      const finish = async (text) => { try { await ctx.editMessageText(text, { parse_mode: 'HTML' }); } catch { /* ignore */ } };

      if (post.status === 'published' && act !== 'back') return ctx.answerCallbackQuery({ text: 'Пост уже опубликован' });
      if (post.status === 'publishing') return ctx.answerCallbackQuery({ text: 'Публикуется…' });
      if (post.status === 'cancelled') return ctx.answerCallbackQuery({ text: 'Пост убран. Создай новый.', show_alert: true });

      switch (act) {
        case 'pub': {
          const claimed = await posts.claimPublish(id); // атомарно: двойной тап не даст дубль
          if (!claimed) return ctx.answerCallbackQuery({ text: 'Уже публикуется или опубликован' });
          await ctx.answerCallbackQuery({ text: 'Публикую…' });
          try {
            post = await publishPost(ctx.api, claimed);
          } catch (e) {
            await posts.update(id, { status: 'failed', error: e.message.slice(0, 500) });
            return ctx.api.sendMessage(chatId, `⚠️ Не удалось опубликовать пост #${id}: ${e.message}\nМожно нажать «Опубликовать сейчас» ещё раз.`).catch(() => {});
          }
          return finish(`✅ <b>Пост #${id} опубликован</b>${post.channel_link ? `\n${post.channel_link}` : ''}`);
        }
        case 'plan': {
          if (!post.scheduled_at || new Date(post.scheduled_at) <= new Date()) return ctx.answerCallbackQuery({ text: 'Время уже прошло. Выбери «Другое время».', show_alert: true });
          post = await posts.update(id, { status: 'scheduled' });
          await ctx.answerCallbackQuery({ text: 'Запланировано' });
          await finish(controlText(post, rt, '✅ Одобрено, выйдет автоматически.'));
          return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard(post, 'main', rt) });
        }
        case 't': {
          const when = new Date(Number(arg) * 1000);
          if (!(when > new Date())) return ctx.answerCallbackQuery({ text: 'Это время уже прошло, выбери другое.', show_alert: true });
          post = await posts.update(id, { status: 'scheduled', scheduled_at: when.toISOString() });
          await ctx.answerCallbackQuery({ text: 'Запланировано' });
          await finish(controlText(post, rt, '✅ Одобрено, выйдет автоматически.'));
          return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard(post, 'main', rt) });
        }
        case 'sched': await ctx.answerCallbackQuery(); return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard({ ...post, status: 'draft' }, 'sched', rt) });
        case 'tc':
          await setState(chatId, { mode: 'sched', postId: id });
          await ctx.answerCallbackQuery();
          return ctx.reply(`Когда опубликовать? Пример: <code>завтра 18:30</code>, <code>30.10 12:00</code>, <code>2026-11-02 09:15</code> (время по ${rt.tz}).`, { parse_mode: 'HTML' });
        case 'unsched':
          post = await posts.update(id, { status: 'draft' });
          await ctx.answerCallbackQuery({ text: 'Снято с плана' });
          return showDraft(ctx.api, chatId, id);
        case 'back': await ctx.answerCallbackQuery(); return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard(post, 'main', rt) });
        case 'edit':
          await setState(chatId, { mode: 'edit', postId: id });
          await ctx.answerCallbackQuery();
          return ctx.reply('Что поменять? Напиши обычными словами: «сделай короче», «добавь, что код одноразовый», «баннер белый, иконка кубок».');
        case 'banner': await ctx.answerCallbackQuery(); return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard({ ...post, status: 'draft' }, 'banner', rt) });
        case 'bl': case 'bo': case 'bw': {
          const b = { ...post.banner };
          if (act === 'bl') b.layout = cycle(LAYOUTS, b.layout); // чёрный → белый → синий
          if (act === 'bo') b.object = cycle(OBJECTS, b.object);
          if (act === 'bw') b.word = cycle(WORDS, b.word);
          await posts.update(id, { banner: normalizeBanner(b) });
          await ctx.answerCallbackQuery();
          return showDraft(ctx.api, chatId, id, { menu: 'banner' });
        }
        case 'bh': case 'bp': case 'bk': {
          const field = { bh: 'headline', bp: 'pill', bk: 'link' }[act];
          await setState(chatId, { mode: 'banner_field', postId: id, field });
          await ctx.answerCallbackQuery();
          return ctx.reply(`Новый текст для «${{ headline: 'заголовка', pill: 'плашки', link: 'ссылки' }[field]}»? (или «-», чтобы убрать)`);
        }
        case 'regen': {
          await ctx.answerCallbackQuery({ text: 'Пишу другой вариант…' });
          await ctx.api.sendChatAction(chatId, 'typing');
          const gen = await generatePost({ topic: post.topic || 'пост', brief: `${post.brief || ''}\nСделай заметно другой вариант, чем: ${post.html.replace(/<[^>]+>/g, ' ').slice(0, 300)}`, refs: post.refs });
          await posts.update(id, { html: gen.html, banner: gen.banner, buttons: gen.buttons });
          return showDraft(ctx.api, chatId, id);
        }
        case 'cancel': {
          await posts.update(id, { status: 'cancelled' });
          await ctx.answerCallbackQuery({ text: 'Отменено' });
          return finish(`🗑 Пост #${id} отменён.`);
        }
        default: return ctx.answerCallbackQuery();
      }
    } catch (e) {
      console.error('[callback]', e);
      return ctx.answerCallbackQuery({ text: ('Ошибка: ' + e.message).slice(0, 190), show_alert: true }).catch(() => {});
    }
  });

  /* ── текст: правки, время, план, новые посты ── */
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;
    const chatId = ctx.chat.id;
    const st = await getState(chatId);
    try {
      if (st?.mode === 'setprompt') { await clearState(chatId); await setSetting('style_prompt', text); return ctx.reply('✅ Стиль-промпт обновлён.'); }
      if (st?.mode === 'plan_wait') { await clearState(chatId); return await importPlan(ctx, text); }
      if (st?.mode === 'sched') {
        const rt = await getRuntime();
        const when = parseWhen(text, rt.tz);
        if (!when || when <= new Date()) return ctx.reply('Не понял время или оно уже прошло. Пример: «завтра 18:30» или «30.10 12:00».');
        await clearState(chatId);
        const post = await posts.update(st.postId, { status: 'scheduled', scheduled_at: when.toISOString() });
        await ctx.reply(`✅ Запланировано на ${fmt(when, rt.tz)}.`);
        return showDraft(ctx.api, chatId, post.id);
      }
      if (st?.mode === 'banner_field') {
        await clearState(chatId);
        const post = await posts.get(st.postId);
        await posts.update(st.postId, { banner: normalizeBanner({ ...post.banner, [st.field]: text === '-' ? '' : text }) });
        return showDraft(ctx.api, chatId, st.postId, { menu: 'banner' });
      }
      if (st?.mode === 'edit') {
        await clearState(chatId);
        const wait = await ctx.reply('⏳ Вношу правки…');
        try {
          const post = await posts.get(st.postId);
          const upd = await revisePost(post, text);
          await posts.update(st.postId, { html: upd.html, banner: upd.banner, buttons: upd.buttons, history: [...(post.history || []), text].slice(-20) });
        } finally { await ctx.api.deleteMessage(chatId, wait.message_id).catch(() => {}); }
        return showDraft(ctx.api, chatId, st.postId);
      }
      if (looksLikePlan(text)) {
        await setState(chatId, { mode: 'plan_pending', text });
        return ctx.reply('Похоже на контент-план. Разобрать его по дням?', { reply_markup: new InlineKeyboard().text('✅ Да, это план', 'plan:yes').text('Нет, это тема поста', 'plan:no') });
      }
      return await newFromText(ctx, text);
    } catch (e) {
      console.error('[text]', e);
      return ctx.reply('⚠️ ' + e.message);
    }
  });

  bot.catch((err) => console.error('[bot]', err.error?.message || err));
  return bot;
}

export async function setupMenu(bot) {
  if (cfg.publicUrl.startsWith('https://')) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Студия', web_app: { url: cfg.publicUrl + '/app/' } } }).catch((e) => console.warn('[menu]', e.message));
  }
  await bot.api.setMyCommands([
    { command: 'plan', description: 'Контент-план и статусы' },
    { command: 'today', description: 'Сделать пост на сегодня сейчас' },
    { command: 'dailytime', description: 'Время ежедневного поста' },
    { command: 'daily', description: 'Авто-режим вкл/выкл' },
    { command: 'studio', description: 'Открыть мини-приложение' },
    { command: 'queue', description: 'Очередь публикаций' },
    { command: 'pack', description: 'Загрузить пак премиум-эмодзи' },
    { command: 'channel', description: 'Канал для публикаций' },
    { command: 'prompt', description: 'Стиль-промпт' },
    { command: 'help', description: 'Помощь' },
  ]).catch(() => {});
}
