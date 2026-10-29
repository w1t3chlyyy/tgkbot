import { Bot, InlineKeyboard } from 'grammy';
import { cfg } from './config.js';
import { posts, getRuntime, setSetting, getSetting, saveEmojiPack, loadEmojiMap } from './store.js';
import { generatePost, revisePost } from './post.js';
import { normalizeBanner } from './banner.js';
import { showDraft, controlText, menuKeyboard, cb, cycle, OBJECTS, WORDS } from './draft.js';
import { publishPost } from './publisher.js';
import { parseWhen, fmt } from './tz.js';
import { DEFAULT_STYLE } from './prompts.js';

const state = new Map(); // chatId → { mode, postId }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HELP = `<b>Hustlify · студия постов</b>

Просто напиши тему и тезисы — я пришлю готовый пост с баннером на согласование.
Первая строка — тема, дальше (необязательно) тезисы.

<b>Команды</b>
/studio — открыть мини-приложение (источники из баз, план, очередь, настройки)
/queue — что запланировано
/pack <i>ссылка или имя пака</i> — загрузить пак премиум-эмодзи
/emoji on|off — вкл/выкл премиум-эмодзи
/channel <i>@канал или -100…</i> — куда публиковать
/prompt — задать стиль-промпт
/cancel — сбросить текущее действие`;

export function createBot() {
  const bot = new Bot(cfg.botToken, cfg.tgApiRoot ? { client: { apiRoot: cfg.tgApiRoot } } : undefined);

  // доступ только админам
  bot.use(async (ctx, next) => {
    if (!ctx.from || !cfg.adminIds.has(ctx.from.id)) {
      if (ctx.chat?.type === 'private') await ctx.reply('Это приватный бот команды Hustlify.');
      return;
    }
    await next();
  });

  const appKb = () => (cfg.publicUrl.startsWith('https://') ? new InlineKeyboard().webApp('📱 Открыть студию', cfg.publicUrl + '/app/') : undefined);

  bot.command('start', (ctx) => ctx.reply(HELP, { parse_mode: 'HTML', reply_markup: appKb() }));
  bot.command('help', (ctx) => ctx.reply(HELP, { parse_mode: 'HTML', reply_markup: appKb() }));
  bot.command('studio', (ctx) => ctx.reply(appKb() ? 'Мини-приложение:' : 'PUBLIC_URL должен быть https://… — задай его в .env', { reply_markup: appKb() }));
  bot.command('cancel', (ctx) => { state.delete(ctx.chat.id); return ctx.reply('Ок, сбросил.'); });

  bot.command('queue', async (ctx) => {
    const rt = await getRuntime();
    const list = await posts.list('scheduled');
    if (!list.length) return ctx.reply('Очередь пуста.');
    list.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    return ctx.reply(list.map((p) => `#${p.id} · ${fmt(p.scheduled_at, rt.tz)} — ${p.topic || p.html.replace(/<[^>]+>/g, '').slice(0, 50)}`).join('\n'));
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
    state.set(ctx.chat.id, { mode: 'setprompt' });
    return ctx.reply(`Текущий стиль-промпт:\n\n${cur.slice(0, 1500)}\n\nПришли новый одним сообщением, чтобы заменить (или /cancel).`);
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

      if (post.status === 'published' && !['back'].includes(act)) return ctx.answerCallbackQuery({ text: 'Пост уже опубликован' });

      switch (act) {
        case 'pub': {
          await ctx.answerCallbackQuery({ text: 'Публикую…' });
          post = await publishPost(ctx.api, post);
          return finish(`✅ <b>Пост #${id} опубликован</b>${post.channel_link ? `\n${post.channel_link}` : ''}`);
        }
        case 'plan': {
          post = await posts.update(id, { status: 'scheduled' });
          await ctx.answerCallbackQuery({ text: 'Запланировано' });
          await finish(controlText(post, rt, '✅ Одобрено, выйдет автоматически.'));
          return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard(post, 'main', rt) });
        }
        case 't': {
          const when = new Date(Number(arg) * 1000);
          post = await posts.update(id, { status: 'scheduled', scheduled_at: when.toISOString() });
          await ctx.answerCallbackQuery({ text: 'Запланировано' });
          await finish(controlText(post, rt, '✅ Одобрено, выйдет автоматически.'));
          return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard(post, 'main', rt) });
        }
        case 'sched': await ctx.answerCallbackQuery(); return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard({ ...post, status: 'draft' }, 'sched', rt) });
        case 'tc':
          state.set(chatId, { mode: 'sched', postId: id });
          await ctx.answerCallbackQuery();
          return ctx.reply(`Когда опубликовать? Пример: <code>завтра 18:30</code>, <code>30.10 12:00</code>, <code>2026-11-02 09:15</code> (время по ${rt.tz}).`, { parse_mode: 'HTML' });
        case 'unsched':
          post = await posts.update(id, { status: 'draft' });
          await ctx.answerCallbackQuery({ text: 'Снято с плана' });
          return showDraft(ctx.api, chatId, id);
        case 'back': await ctx.answerCallbackQuery(); return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard(post, 'main', rt) });
        case 'edit':
          state.set(chatId, { mode: 'edit', postId: id });
          await ctx.answerCallbackQuery();
          return ctx.reply('Что поменять? Напиши обычными словами: «сделай короче», «добавь, что код одноразовый», «баннер тёмный, надпись конкурс».');
        case 'banner': await ctx.answerCallbackQuery(); return ctx.editMessageReplyMarkup({ reply_markup: menuKeyboard({ ...post, status: 'draft' }, 'banner', rt) });
        case 'bl': case 'bo': case 'bw': {
          const b = { ...post.banner };
          if (act === 'bl') b.layout = b.layout === 'dark' ? 'light' : 'dark';
          if (act === 'bo') b.object = cycle(OBJECTS, b.object);
          if (act === 'bw') b.word = cycle(WORDS, b.word);
          await posts.update(id, { banner: normalizeBanner(b) });
          await ctx.answerCallbackQuery();
          return showDraft(ctx.api, chatId, id, { menu: 'banner' });
        }
        case 'bh': case 'bp': case 'bk': {
          const field = { bh: 'headline', bp: 'pill', bk: 'link' }[act];
          state.set(chatId, { mode: 'banner_field', postId: id, field });
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
      return ctx.answerCallbackQuery({ text: ('Ошибка: ' + e.message).slice(0, 190), show_alert: true });
    }
  });

  /* ── текст: правки, время, новые посты ── */
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;
    const chatId = ctx.chat.id;
    const st = state.get(chatId);
    try {
      if (st?.mode === 'setprompt') {
        state.delete(chatId); await setSetting('style_prompt', text);
        return ctx.reply('✅ Стиль-промпт обновлён.');
      }
      if (st?.mode === 'sched') {
        const rt = await getRuntime();
        const when = parseWhen(text, rt.tz);
        if (!when || when <= new Date()) return ctx.reply('Не понял время или оно уже прошло. Пример: «завтра 18:30» или «30.10 12:00».');
        state.delete(chatId);
        const post = await posts.update(st.postId, { status: 'scheduled', scheduled_at: when.toISOString() });
        await ctx.reply(`✅ Запланировано на ${fmt(when, rt.tz)}.`);
        return showDraft(ctx.api, chatId, post.id);
      }
      if (st?.mode === 'banner_field') {
        state.delete(chatId);
        const post = await posts.get(st.postId);
        const b = normalizeBanner({ ...post.banner, [st.field]: text === '-' ? '' : text });
        await posts.update(st.postId, { banner: b });
        return showDraft(ctx.api, chatId, st.postId, { menu: 'banner' });
      }
      if (st?.mode === 'edit') {
        state.delete(chatId);
        const wait = await ctx.reply('⏳ Вношу правки…');
        const post = await posts.get(st.postId);
        const upd = await revisePost(post, text);
        await posts.update(st.postId, { html: upd.html, banner: upd.banner, buttons: upd.buttons, history: [...(post.history || []), text].slice(-20) });
        await ctx.api.deleteMessage(chatId, wait.message_id).catch(() => {});
        return showDraft(ctx.api, chatId, st.postId);
      }
      // новый пост из сообщения
      const [topic, ...rest] = text.split('\n');
      const wait = await ctx.reply('⏳ Пишу пост и рисую баннер…');
      const gen = await generatePost({ topic: topic.trim(), brief: rest.join('\n').trim() });
      const post = await posts.create({ status: 'draft', topic: topic.trim().slice(0, 200), brief: rest.join('\n').trim(), html: gen.html, banner: gen.banner, buttons: gen.buttons, admin_chat_id: chatId });
      await ctx.api.deleteMessage(chatId, wait.message_id).catch(() => {});
      return showDraft(ctx.api, chatId, post.id);
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
    { command: 'studio', description: 'Открыть мини-приложение' },
    { command: 'queue', description: 'Очередь публикаций' },
    { command: 'pack', description: 'Загрузить пак премиум-эмодзи' },
    { command: 'emoji', description: 'Премиум-эмодзи вкл/выкл' },
    { command: 'channel', description: 'Канал для публикаций' },
    { command: 'prompt', description: 'Стиль-промпт' },
    { command: 'help', description: 'Помощь' },
  ]).catch(() => {});
}
