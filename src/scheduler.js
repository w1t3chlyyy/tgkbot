import { cfg } from './config.js';
import { posts } from './store.js';
import { publishPost } from './publisher.js';

export function startScheduler(api, everyMs = 20_000) {
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try {
      for (const p of await posts.due()) {
        const claimed = await posts.claim(p.id);
        if (!claimed) continue;
        const notify = claimed.admin_chat_id || [...cfg.adminIds][0];
        try {
          const done = await publishPost(api, claimed);
          await api.sendMessage(notify, `✅ По расписанию опубликован пост #${done.id}${done.channel_link ? `\n${done.channel_link}` : ''}`).catch(() => {});
        } catch (e) {
          console.error('[scheduler]', e.message);
          await posts.update(claimed.id, { status: 'failed', error: e.message.slice(0, 500) });
          await api.sendMessage(notify, `⚠️ Не удалось опубликовать пост #${claimed.id}: ${e.message}`).catch(() => {});
        }
      }
    } catch (e) { console.error('[scheduler tick]', e.message); }
    finally { busy = false; }
  };
  setInterval(tick, everyMs);
  tick();
}
