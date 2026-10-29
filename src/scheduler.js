// Один «тик» фоновой работы. На Vercel его раз в минуту вызывает cron-job.org → /api/cron;
// на обычном сервере (index.js) — setInterval.
import { cfg } from './config.js';
import { posts, cleanupUpdates } from './store.js';
import { publishPost } from './publisher.js';
import { dailyTick } from './planner.js';

async function publishDue(api, defer) {
  let n = 0;
  for (const p of await posts.due()) {
    const claimed = await posts.claim(p.id);
    if (!claimed) continue;
    n++;
    defer((async () => {
      const notify = claimed.admin_chat_id || [...cfg.adminIds][0];
      try {
        const done = await publishPost(api, claimed);
        await api.sendMessage(notify, `✅ По расписанию опубликован пост #${done.id}${done.channel_link ? `\n${done.channel_link}` : ''}`).catch(() => {});
      } catch (e) {
        console.error('[cron publish]', e.message);
        await posts.update(claimed.id, { status: 'failed', error: e.message.slice(0, 500) });
        await api.sendMessage(notify, `⚠️ Не удалось опубликовать пост #${claimed.id}: ${e.message}`).catch(() => {});
      }
    })());
  }
  return n;
}

/** defer(promise) — «доделать после ответа»: на Vercel это waitUntil, локально — просто ловим ошибки. */
export async function runCron(api, { defer = (p) => p, now = new Date() } = {}) {
  const published = await publishDue(api, defer);
  const daily = await dailyTick(api, { now, defer });
  if (now.getUTCMinutes() === 0) defer(cleanupUpdates());
  return { published, daily };
}

export function startInterval(api, everyMs = 30_000) {
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { await runCron(api, { defer: (p) => p.catch((e) => console.error('[cron]', e.message)) }); }
    catch (e) { console.error('[cron tick]', e.message); } finally { busy = false; }
  };
  setInterval(tick, everyMs); tick();
}
