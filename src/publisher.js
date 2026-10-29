import { posts, getRuntime } from './store.js';
import { sendPost, postLink } from './tgsend.js';

export async function publishPost(api, post) {
  const rt = await getRuntime();
  if (!rt.channel) throw new Error('Канал не задан: CHANNEL_ID в .env или «Настройки» в мини-приложении');
  const { ids, chat } = await sendPost(api, rt.channel, post);
  return posts.update(post.id, {
    status: 'published', published_at: new Date().toISOString(),
    channel_msg_ids: ids, channel_link: postLink(chat, ids), error: null,
  });
}
