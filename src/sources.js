// Подключение внешних баз (каталог, кейсы, партнёры, проекты, портфолио...) как источника материала для постов.
import { cfg } from './config.js';
import { rest } from './db.js';

// Таблицы, которые бот НЕ показывает и НЕ отправляет в Qwen, пока ты не перечислишь их в DATABASES.tables явно.
const SENSITIVE = /order|promo|requisite|payment|receipt|user|employee|audit|admin|session|secret|token|credential|password|assignment|business|coin|wallet|invoice|state|log$/i;
const HIDDEN_COLS = /password|hash|secret|token|key$|email|phone|tg_id|telegram_id|chat_id|ip$/i;
const LABEL_GUESS = ['title', 'name', 'headline', 'slug', 'tag', 'id'];

const clients = new Map();
function client(d) {
  if (!clients.has(d.name)) clients.set(d.name, rest({ url: d.url, key: d.key }));
  return clients.get(d.name);
}
function dbCfg(name) {
  const d = cfg.databases.find((x) => x.name === name);
  if (!d) throw new Error(`База «${name}» не описана в DATABASES`);
  return d;
}

let catalogCache = { at: 0, data: null };
export async function listCatalog(force = false) {
  if (!force && catalogCache.data && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.data;
  const out = [];
  for (const d of cfg.databases) {
    try {
      let tables = [];
      if (d.tables && Object.keys(d.tables).length) {
        tables = Object.entries(d.tables).map(([table, o]) => ({ table, label: o?.label || null, id: o?.id || 'id' }));
      } else {
        const spec = await client(d).openapi();
        tables = Object.keys(spec.definitions || {}).filter((t) => !SENSITIVE.test(t)).map((table) => ({ table, label: null, id: 'id' }));
      }
      for (const t of tables) out.push({ db: d.name, table: t.table, label: t.label, idCol: t.id });
    } catch (e) {
      console.error(`[sources] ${d.name}:`, e.message);
      out.push({ db: d.name, table: null, error: e.message });
    }
  }
  catalogCache = { at: Date.now(), data: out };
  return out;
}

async function tableMeta(dbName, table) {
  const cat = await listCatalog();
  const m = cat.find((c) => c.db === dbName && c.table === table);
  if (!m) throw new Error(`Таблица ${dbName}.${table} недоступна (не найдена или в чёрном списке)`);
  return m;
}

export function labelOf(row, meta) {
  const keys = [meta?.label, ...LABEL_GUESS].filter(Boolean);
  for (const k of keys) if (row[k] != null && String(row[k]).trim()) return String(row[k]).replace(/<[^>]+>/g, '').slice(0, 90);
  return `#${row.id ?? '?'}`;
}

export async function searchRows(dbName, table, q = '', limit = 30) {
  const meta = await tableMeta(dbName, table);
  const d = dbCfg(dbName);
  let qs = `limit=${limit}`;
  const lab = meta.label || (await guessLabelCol(d, table));
  if (q && lab) qs += `&${lab}=ilike.*${encodeURIComponent(q.replace(/[*,()]/g, ' '))}*`;
  let rows;
  try { rows = await client(d).select(table, qs + '&order=created_at.desc'); } catch { rows = await client(d).select(table, qs); }
  return rows.map((r) => ({ id: r[meta.idCol], label: labelOf(r, { label: lab }), preview: rowToText(r).slice(0, 160) }));
}

async function guessLabelCol(d, table) {
  try {
    const r = await client(d).select(table, 'limit=1');
    if (r?.[0]) return LABEL_GUESS.find((k) => k in r[0] && typeof r[0][k] === 'string') || null;
  } catch { /* ignore */ }
  return null;
}

export async function getRow(dbName, table, id) {
  const meta = await tableMeta(dbName, table);
  const rows = await client(dbCfg(dbName)).select(table, `${meta.idCol}=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

export function rowToText(row, maxLen = 1500) {
  const parts = [];
  for (const [k, v] of Object.entries(row)) {
    if (v == null || v === '' || v === false) continue;
    if (HIDDEN_COLS.test(k) || /^(created_at|updated_at|deleted|hidden|img|image|logo|icon)$/i.test(k)) continue;
    if (typeof v === 'object') continue;
    let s = String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || /^data:/.test(s)) continue;
    parts.push(`${k}: ${s.slice(0, 600)}`);
  }
  return parts.join('\n').slice(0, maxLen);
}

/** refs: [{db, table, id}] → текст-материал для Qwen */
export async function materialFromRefs(refs = []) {
  const blocks = [];
  for (const r of refs.slice(0, 8)) {
    try {
      const row = await getRow(r.db, r.table, r.id);
      if (row) blocks.push(`[${r.db}.${r.table} #${r.id}]\n${rowToText(row)}`);
    } catch (e) { console.error('[material]', e.message); }
  }
  return blocks.join('\n\n');
}

/** Сводка по базам для генерации плана (несколько строк из каждой таблицы) */
export async function overview(perTable = 4, maxLen = 7000) {
  const cat = (await listCatalog()).filter((c) => c.table);
  const blocks = [];
  for (const c of cat) {
    try {
      const rows = await client(dbCfg(c.db)).select(c.table, `limit=${perTable}`);
      if (rows?.length) blocks.push(`## ${c.db}.${c.table}\n` + rows.map((r) => '- ' + rowToText(r, 380).replace(/\n/g, '; ')).join('\n'));
    } catch { /* ignore */ }
  }
  return blocks.join('\n\n').slice(0, maxLen);
}

/** Стиль-промпт из твоей БД, если задан STYLE_PROMPT_SOURCE */
export async function fetchStylePrompt() {
  const s = cfg.stylePromptSource;
  if (!s) return null;
  try {
    const d = dbCfg(s.db);
    const where = Object.entries(s.where || {}).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const rows = await client(d).select(s.table, `${where}&limit=1`);
    return rows?.[0]?.[s.column] || null;
  } catch (e) { console.error('[style prompt]', e.message); return null; }
}
