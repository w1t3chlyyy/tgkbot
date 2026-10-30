import { PlanItem, SourceTable } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function parsePastedPlan(text: string, startDate?: string): PlanItem[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const items: PlanItem[] = [];
  const dateRegex = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*(?:[—–:-]\s*)?(.*)$/;

  const now = new Date();
  let baseDate = startDate ? new Date(startDate) : now;
  let dayOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(dateRegex);

    let dayStr: string;
    let content: string;

    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const y = match[3] ? parseInt(match[3], 10) : now.getFullYear();
      const fullYear = y < 100 ? 2000 + y : y;
      dayStr = `${fullYear}-${pad(m)}-${pad(d)}`;
      content = match[4].trim();
    } else {
      const target = new Date(baseDate);
      target.setDate(target.getDate() + dayOffset);
      dayStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
      content = line.replace(/^\d+[\s.)-]+\s*/, '').trim();
      dayOffset++;
    }

    if (!content) continue;

    const parts = content.split(/\s*—\s*|\s*:\s*|\s*\|\s*/);
    const topic = parts[0] || content;
    const brief = parts.slice(1).join(' — ') || `Пост на тему: ${topic}`;

    items.push({
      id: Date.now() + i,
      day: dayStr,
      topic: topic.slice(0, 150),
      brief: brief.slice(0, 400),
      status: 'idea',
    });
  }

  return items;
}

export function generatePlanItems(days: number, focus: string, sources: SourceTable[]): PlanItem[] {
  const items: PlanItem[] = [];
  const now = new Date();

  const TOPIC_TEMPLATES = [
    {
      topic: 'Набор в команду: обучение с оплатой до 120 000 ₽',
      brief: 'Хук: Это не вакансия. Это обучение, за которое платят. Разбор пути от анкеты через симулятор с ИИ-клиентом до выплат за найденный бизнес.',
      refTable: 'vacancies',
    },
    {
      topic: 'Премиум-кейс: как Telegram WebApp увеличил конверсию на 40%',
      brief: 'Хук: Клиенты устали переходить на сайты. Разбираем реальный кейс внедрения каталога с оплатой в 1 клик.',
      refTable: 'cases',
    },
    {
      topic: 'Рулетка промокодов и бонусных коинов в Hustlify',
      brief: 'Хук: Сегодня не про работу, а про чистый бонус на баланс. Запуск рулетки призов для всех подписчиков.',
      refTable: 'promos',
    },
    {
      topic: 'Срочный набор: видеомейкер и съёмка кейсов',
      brief: 'Хук: Умеешь держать камеру и чувствуешь свет? Ищем рилсмейкера в команду. Оплата сдельная за ролик.',
      refTable: 'vacancies',
    },
    {
      topic: 'Разбор возражения: «У нас уже есть сайт, зачем нам бот?»',
      brief: 'Хук: 9 из 10 посетителей уходят с мобильного сайта. В Telegram открываемость пушей 85%. Сравниваем цифры.',
      refTable: 'catalog',
    },
    {
      topic: 'Кейс автоматизации: доставка и бронирование без операторов',
      brief: 'Хук: Заказы принимаются даже ночью без участия менеджера. Как устроена автоворонка под ключ.',
      refTable: 'cases',
    },
    {
      topic: 'Интерактив: выбери лучший дизайн баннера для промо',
      brief: 'Хук: А или Б? Показываем два варианта баннера и спрашиваем мнение аудитории в комментариях.',
      refTable: '',
    },
  ];

  for (let i = 0; i < days; i++) {
    const target = new Date(now);
    target.setDate(target.getDate() + i + 1);
    const dayStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;

    const template = TOPIC_TEMPLATES[i % TOPIC_TEMPLATES.length];
    let topic = template.topic;
    let brief = template.brief;

    if (focus && i % 2 === 0) {
      topic = `${focus}: день ${i + 1} — ${template.topic}`;
      brief = `Фокус: ${focus}. ${template.brief}`;
    }

    const tableObj = sources.find((s) => s.table === template.refTable);
    const ref = tableObj?.rows?.[i % (tableObj.rows.length || 1)];

    items.push({
      id: Date.now() + i * 10,
      day: dayStr,
      topic,
      brief,
      status: 'idea',
      refs: ref ? [{ db: tableObj.db, table: tableObj.table, id: ref.id, label: ref.label }] : undefined,
    });
  }

  return items;
}
