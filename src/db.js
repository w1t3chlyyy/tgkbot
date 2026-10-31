// Минимальный клиент PostgREST (Supabase) без SDK.
export function rest({ url, key }) {
  const base = url.replace(/\/$/, '') + '/rest/v1';
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  async function req(method, path, { body, prefer } = {}) {
    const r = await fetch(base + path, {
      method,
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000), // без таймаута зависшая база съедает всё время функции
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} → ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    select: (table, qs = '') => req('GET', `/${table}${qs ? '?' + qs : ''}`),
    insert: (table, row) => req('POST', `/${table}`, { body: row, prefer: 'return=representation' }),
    update: (table, qs, patch) => req('PATCH', `/${table}?${qs}`, { body: patch, prefer: 'return=representation' }),
    remove: (table, qs) => req('DELETE', `/${table}?${qs}`),
    upsert: (table, rows, onConflict) =>
      req('POST', `/${table}?on_conflict=${onConflict}`, { body: rows, prefer: 'resolution=merge-duplicates,return=representation' }),
    insertIgnore: (table, row, onConflict) =>
      req('POST', `/${table}?on_conflict=${onConflict}`, { body: row, prefer: 'resolution=ignore-duplicates,return=representation' }),
    async openapi() {
      const r = await fetch(base + '/', { headers, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`Supabase openapi → ${r.status}`);
      return r.json();
    },
  };
}
