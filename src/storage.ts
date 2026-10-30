import { PlanItem, PostItem, Settings, SourceTable } from './types';
import { DEFAULT_STYLE } from './defaultPrompts';

export const DEFAULT_LINKS: Record<string, string> = {
  site: 'https://hustlify.site',
  catalog: 'https://t.me/hustlifybot',
  cases: 'https://t.me/hustlifycasesbot',
  sales: 'https://t.me/hustlifysalerobot',
  support: 'https://t.me/HustlifyHelp',
};

const INITIAL_SETTINGS: Settings = {
  channel: '@hustlify',
  tz: 'Europe/Moscow',
  defaultTime: '18:00',
  dailyTime: '10:00',
  dailyEnabled: true,
  approver: 5119044165,
  customEmoji: true,
  links: DEFAULT_LINKS,
  stylePrompt: DEFAULT_STYLE,
  botToken: '',
  adminIds: '5119044165',
  channelId: '@hustlify',
};

const getTodayString = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const INITIAL_PLAN: PlanItem[] = [
  {
    id: 1,
    day: getTodayString(0),
    topic: 'Рулетка промокодов и как забрать скидку до 50%',
    brief: 'Хук: Сегодня не про работу, а про деньги на твоём балансе. Тезисы: запускаем рулетку промокодов в боте, каждый билет даёт скидку или бонус в коинах. Вопрос: какую скидку выбил первым броском?',
    status: 'idea',
    refs: [{ db: 'hustlify_main', table: 'promos', id: 'wheel_autumn', label: 'Осенняя рулетка 2026' }],
  },
  {
    id: 2,
    day: getTodayString(1),
    topic: 'Набор в команду продаж: обучение с оплатой до 120 000 ₽',
    brief: 'Хук: Это не вакансия. Это обучение, за которое платят. Тезисы: путь от анкеты через симулятор со сложным клиентом до реальных выплат. Оплата только за найденный бизнес и отчёт с фото. Вопрос: ты за продажи или за видео?',
    status: 'idea',
    refs: [{ db: 'hustlify_main', table: 'vacancies', id: 'sales_lead', label: 'Менеджер в продажи' }],
  },
  {
    id: 3,
    day: getTodayString(2),
    topic: 'Премиум-кейс Apex Core: как бот поднял конверсию на 43%',
    brief: 'Хук: Клиент пришёл с хаосом в заявках — ушёл с автоворонкой под ключ. Тезисы: разбор кейса Apex Core, подключение Telegram WebApp, аналитика заказов. Вопрос: какой этап воронки у вас проседает сильнее?',
    status: 'idea',
    refs: [{ db: 'hustlify_main', table: 'cases', id: 'case_apex', label: 'Кейс Apex Core' }],
  },
  {
    id: 4,
    day: getTodayString(3),
    topic: 'Вакансия: видеооператор и рилсмейкер в команду Hustlify',
    brief: 'Хук: Умеешь держать камеру и резать динамику? Нам нужен человек с глазом. Тезисы: снимать бэкстейджи и промо. Условия уточняй в боте, технику поможем настроить. Вопрос: на что снимаешь сейчас — iPhone или фотоаппарат?',
    status: 'idea',
    refs: [{ db: 'hustlify_main', table: 'vacancies', id: 'video_maker', label: 'Видеооператор Hustlify' }],
  },
  {
    id: 5,
    day: getTodayString(4),
    topic: 'Разбор возражения: «Почему бот лучше отдельного сайта»',
    brief: 'Хук: 9 из 10 клиентов закрывают сайт через 4 секунды. В Telegram они остаются. Тезисы: конверсия WebApp выше в 3.2 раза, нет логинов и SMS-паролей, мгновенная оплата в один тап. Вопрос: когда в последний раз качал отдельное приложение вместо бота?',
    status: 'idea',
  },
];

export const INITIAL_SOURCES: SourceTable[] = [
  {
    db: 'hustlify_main',
    table: 'cases',
    label: 'Кейсы клиентов',
    rows: [
      { id: 'case_apex', label: 'Кейс Apex Core (финтех бот)', preview: 'Разработка Telegram Mini App для обмена и аналитики. +43% конверсия.' },
      { id: 'case_lounge', label: 'Кейс сеть коворкингов Neon', preview: 'Бронирование мест, система лояльности на коинах, интеграция с CRM.' },
      { id: 'case_delivery', label: 'Кейс Craft Bakery', preview: 'Каталог выпечки с мгновенной оплатой через Stars и эквайринг.' },
    ],
  },
  {
    db: 'hustlify_main',
    table: 'vacancies',
    label: 'Вакансии и найм',
    rows: [
      { id: 'sales_lead', label: 'Менеджер в продажи Hustlify', preview: 'До 120 000 ₽/мес. Поиск бизнесов в своём городе, отчёты с фото, оплата в коинах.' },
      { id: 'video_maker', label: 'Видеомейкер / съёмка', preview: 'Съёмка кейсов и рилсов. Оплата сдельная за ролик, условия в боте.' },
    ],
  },
  {
    db: 'hustlify_main',
    table: 'catalog',
    label: 'Каталог услуг и решений',
    rows: [
      { id: 'webapp_studio', label: 'Telegram Mini App под ключ', preview: 'Индивидуальный дизайн, интеграция с базами данных и платежами.' },
      { id: 'stars_hub', label: 'Модуль Telegram Stars & Premium', preview: 'Быстрая выдача подписок и внутренней валюты по оптовым тарифам.' },
    ],
  },
];

export const storage = {
  getSettings(): Settings {
    try {
      const saved = localStorage.getItem('hustlify_settings');
      return saved ? { ...INITIAL_SETTINGS, ...JSON.parse(saved) } : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(s: Settings): void {
    localStorage.setItem('hustlify_settings', JSON.stringify(s));
  },

  getPlan(): PlanItem[] {
    try {
      const saved = localStorage.getItem('hustlify_plan');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    this.savePlan(INITIAL_PLAN);
    return INITIAL_PLAN;
  },

  savePlan(items: PlanItem[]): void {
    localStorage.setItem('hustlify_plan', JSON.stringify(items));
  },

  getPosts(): PostItem[] {
    try {
      const saved = localStorage.getItem('hustlify_posts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  },

  savePosts(posts: PostItem[]): void {
    localStorage.setItem('hustlify_posts', JSON.stringify(posts));
  },

  getSources(): SourceTable[] {
    try {
      const saved = localStorage.getItem('hustlify_sources');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_SOURCES;
  },
};
