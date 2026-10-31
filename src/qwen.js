import { cfg } from './config.js';

async function call(messages, { temperature, maxTokens }) {
  const r = await fetch(`${cfg.qwen.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.qwen.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.qwen.model, messages, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(40_000), // функция Vercel живёт 60 с: лучше понятная ошибка, чем обрыв
  });
  const text = await r.text();
  if (!r.ok) { const e = new Error(`Qwen ${r.status}: ${text.slice(0, 300)}`); e.status = r.status; throw e; }
  return JSON.parse(text).choices?.[0]?.message?.content || '';
}

export async function chatJSON(messages, { temperature = 0.7, maxTokens = 1800 } = {}) {
  let content;
  const t0 = Date.now();
  try { content = await call(messages, { temperature, maxTokens }); }
  catch (e) {
    // повторяем только если ошибка пришла быстро: иначе два захода не влезут в 60 с функции
    if (!(e.status === 429 || e.status >= 500) || Date.now() - t0 > 10_000) throw e;
    await new Promise((r) => setTimeout(r, 1000)); // один повтор при перегрузке API
    content = await call(messages, { temperature, maxTokens });
  }
  return parseLooseJSON(content);
}

export function parseLooseJSON(s) {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* try slice */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('Qwen вернул не-JSON: ' + s.slice(0, 200));
}
