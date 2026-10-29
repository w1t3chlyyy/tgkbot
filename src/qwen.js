import { cfg } from './config.js';

export async function chatJSON(messages, { temperature = 0.7, maxTokens = 1800 } = {}) {
  const r = await fetch(`${cfg.qwen.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.qwen.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.qwen.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Qwen ${r.status}: ${text.slice(0, 300)}`);
  const content = JSON.parse(text).choices?.[0]?.message?.content || '';
  return parseLooseJSON(content);
}

export function parseLooseJSON(s) {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* try slice */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('Qwen вернул не-JSON: ' + s.slice(0, 200));
}
