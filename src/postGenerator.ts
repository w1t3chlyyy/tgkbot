import { BannerSpec, PlanItem, PostButton, PostItem, Settings } from './types';
import { normalizeBannerSpec } from './bannerRenderer';

function guessIcon(topic: string, brief: string): string {
  const t = (topic + ' ' + brief).toLowerCase();
  if (/видео|съ[её]мк|рилс|камер|оператор/.test(t)) return 'play';
  if (/ваканси|набор|команд|продаж|менеджер|найм/.test(t)) return 'team';
  if (/кейс|результат|клиент|портфолио/.test(t)) return 'case';
  if (/конкурс|итог|приз|рулетк|побед/.test(t)) return 'trophy';
  if (/промокод|скидк|цена|распродаж/.test(t)) return 'tag';
  if (/возражен|диалог|чат|вопрос|ответ/.test(t)) return 'chat';
  if (/stars|звёзд|звезд/.test(t)) return 'star';
  if (/premium|премиум/.test(t)) return 'gem';
  if (/топ|лучш|рекорд/.test(t)) return 'crown';
  if (/статистик|рост|цифр|выручк/.test(t)) return 'chart';
  if (/скорост|быстр|момент/.test(t)) return 'bolt';
  if (/безопасн|гарант|защит/.test(t)) return 'shield';
  if (/шаг|инструкц|как сделать/.test(t)) return 'check';
  return 'rocket';
}

function generateButtons(topic: string, settings: Settings): PostButton[] {
  const t = topic.toLowerCase();
  const links = settings.links;

  if (/ваканси|набор|команд|продаж|видео/.test(t)) {
    return [
      { text: 'Заполнить анкету', url: links.sales || 'https://t.me/hustlifysalerobot' },
      { text: 'Открыть Hustlify', url: links.site || 'https://hustlify.site' },
    ];
  }
  if (/кейс|клиент|портфолио/.test(t)) {
    return [
      { text: 'Смотреть все кейсы', url: links.cases || 'https://t.me/hustlifycasesbot' },
      { text: 'Обсудить проект', url: links.support || 'https://t.me/HustlifyHelp' },
    ];
  }
  if (/рулетк|скидк|промокод|каталог/.test(t)) {
    return [
      { text: 'Крутить рулетку', url: links.catalog || 'https://t.me/hustlifybot' },
      { text: 'Сайт Hustlify', url: links.site || 'https://hustlify.site' },
    ];
  }

  return [
    { text: 'Открыть бота', url: links.catalog || 'https://t.me/hustlifybot' },
    { text: 'Сайт Hustlify', url: links.site || 'https://hustlify.site' },
  ];
}

export function generatePostContent(
  topic: string,
  brief: string,
  refs: any[] = [],
  overrides: { banner?: Partial<BannerSpec> } = {},
  settings: Settings
): { html: string; banner: BannerSpec; buttons: PostButton[] } {
  const icon = overrides.banner?.object || guessIcon(topic, brief);
  const layout = overrides.banner?.layout || (Math.random() > 0.35 ? 'dark' : 'light');

  let hook = '';
  let body = '';
  let question = '';
  const cleanTopic = topic.trim();
  const t = (topic + ' ' + brief).toLowerCase();

  if (/ваканси|набор|команд|продаж/.test(t)) {
    hook = '<b>Это не вакансия. Это оплачиваемое обучение с выходом на реальные чеки.</b>';
    body = `Мы расширяем команду Hustlify в городах. Ты не продаёшь в холодную и не спамишь друзьям.

Твоя задача простая:
1. Найти бизнес в своём городе, которому нужен поток клиентов
2. Сделать короткий аудит и фотоотчёт в боте
3. Получить оплату на баланс в коинах

<blockquote>Заработок: <code>до 120 000 ₽ в месяц</code>. Всё прозрачно — выплаты за каждую принятую заявку без задержек.</blockquote>

Путь новичка: анкета → симулятор со сложным ИИ-клиентом → личный кабинет партнёра.`;
    question = 'Вопрос в комментарии: ты больше за личные встречи или за общение в переписке?';
  } else if (/видео|съ[её]мк|рилс/.test(t)) {
    hook = '<b>Умеешь держать камеру и чувствуешь динамику кадра? Забирай проекты.</b>';
    body = `Для презентаций наших Telegram WebApp и кейсов клиентов ищем людей с прямыми руками и вкусом.

Что снимаем:
• Бэкстейджи запусков и живые реакции клиентов
• Короткие динамичные рилсы до 30 секунд
• Тестирование интерфейсов в реальных заведениях

<blockquote>Условия сдельные за каждый принятый ролик. Настройки и пресеты даём, если нужно — подтянем монтаж.</blockquote>`;
    question = 'Напиши в комментарии: на что снимаешь сейчас — iPhone или беззеркалку?';
  } else if (/кейс|apex|клиент/.test(t)) {
    hook = '<b>Клиент пришёл с хаосом в заявках — ушёл с автоворонкой под ключ.</b>';
    body = `Разбираем свежий кейс разработки для проекта <code>Apex Core</code>.

Что было: заявки терялись в личках менеджеров, клиенты ждали ответа по 2 часа, конверсия болталась на уровне 4%.

Что сделали:
1. Запустили фирменный <b>Telegram Mini App</b> без переходов на сторонние сайты
2. Настроили мгновенную оплату и каталог с фильтрами
3. Подключили авто-уведомления о статусе заказа

<blockquote>Результат: конверсия выросла на <code>+43%</code> в первую же неделю, а среднее время оформления сократилось до 45 секунд.</blockquote>`;
    question = 'Какой этап воронки у вас проседает сильнее всего — первый контакт или оплата?';
  } else if (/рулетк|промокод|скидк/.test(t)) {
    hook = '<b>Сегодня не про сложную работу, а про чистую выгоду на твоём балансе.</b>';
    body = `Мы обновили призовой фонд в @HustlifyBot и запустили рулетку скидок.

Что внутри:
• Промокоды на разработку ботов до <code>50%</code>
• Пакеты Telegram Stars по специальному курсу
• Бонусные коины, которые можно потратить на услуги

<blockquote>Каждый билет гарантированно приносит приз. Первый спин доступен сразу после авторизации.</blockquote>`;
    question = 'Какую скидку выбил первым броском? Пиши результат в комментарии 👇';
  } else {
    hook = `<b>${cleanTopic}</b>`;
    body = `${brief ? brief : 'Разбираем важные обновления и возможности для автоматизации бизнеса в Telegram.'}

<blockquote>Hustlify объединяет передовой WebApp дизайн, мгновенные платежи и умных ботов для роста ваших продаж.</blockquote>

Все ссылки и подробности уже доступны в боте.`;
    question = 'Что думаешь по этому поводу? Делись мнением в комментариях!';
  }

  const html = `${hook}\n\n${body}\n\n${question}`;

  const bannerHeadline = cleanTopic.length > 36 ? cleanTopic.slice(0, 36) + '…' : cleanTopic;
  const banner: BannerSpec = normalizeBannerSpec({
    layout,
    object: icon,
    headline: overrides.banner?.headline || bannerHeadline,
    sub: overrides.banner?.sub || (brief ? brief.slice(0, 50) : 'Hustlify Channel'),
    pill: overrides.banner?.pill || (/ваканси|набор/.test(t) ? 'Набор открыт' : /кейс/.test(t) ? 'Кейс' : 'Hustlify'),
    link: overrides.banner?.link || 'hustlify.site',
    style: overrides.banner?.style || (Math.random() > 0.5 ? 'coin' : 'corner'),
  });

  const buttons = generateButtons(cleanTopic, settings);

  return { html, banner, buttons };
}

export async function makePostFromPlanItem(
  item: PlanItem,
  settings: Settings,
  overrides: { banner?: Partial<BannerSpec> } = {}
): Promise<{ post: PostItem; updatedItem: PlanItem }> {
  const gen = generatePostContent(item.topic, item.brief, item.refs || [], overrides, settings);

  const newPost: PostItem = {
    id: Date.now(),
    status: 'draft',
    topic: item.topic,
    brief: item.brief,
    refs: item.refs || [],
    html: gen.html,
    banner: gen.banner,
    buttons: gen.buttons,
    scheduled_at: `${item.day}T${settings.defaultTime}:00.000Z`,
    created_at: new Date().toISOString(),
  };

  const updatedItem: PlanItem = {
    ...item,
    status: 'made',
    post_id: newPost.id,
  };

  // Optional Telegram bot integration
  if (settings.botToken && settings.approver) {
    try {
      await sendToTelegramChat(settings.botToken, settings.approver, newPost);
    } catch (e) {
      console.warn('[telegram bot]', e);
    }
  }

  return { post: newPost, updatedItem };
}

async function sendToTelegramChat(token: string, chatId: number | string, post: PostItem) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const cleanText = post.html.replace(/<[^>]+>/g, '');
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🔥 Новый подготовленный пост:\n\n${cleanText}\n\nКнопки:\n${post.buttons.map((b) => `${b.text} - ${b.url}`).join('\n')}`,
    }),
  });
}
