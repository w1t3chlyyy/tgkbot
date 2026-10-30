import React from 'react';
import { PostItem, Settings } from '../types';
import { BannerPreview } from './BannerPreview';

interface QueueTabProps {
  posts: PostItem[];
  settings: Settings;
  onOpenDraft: (post: PostItem) => void;
  onUpdatePost: (post: PostItem) => void;
  onDeletePost: (id: number) => void;
  showToast: (msg: string, isError?: boolean) => void;
}

export const QueueTab: React.FC<QueueTabProps> = ({
  posts,
  settings,
  onOpenDraft,
  onUpdatePost,
  onDeletePost,
  showToast,
}) => {
  const STATUS_MAP: Record<string, string> = {
    draft: 'черновик',
    scheduled: 'в плане',
    published: 'опубликован',
    failed: 'ошибка',
    cancelled: 'убран',
    publishing: 'публикуется',
  };

  const handleSendToChat = (post: PostItem) => {
    if (settings.botToken && settings.approver) {
      showToast('Отправлено в чат с ботом');
    } else {
      const clean = post.html.replace(/<[^>]+>/g, '');
      navigator.clipboard.writeText(clean);
      showToast('Бот не подключён: текст скопирован в буфер');
    }
  };

  const handlePublish = (post: PostItem) => {
    const updated: PostItem = {
      ...post,
      status: 'published',
      channel_link: `https://t.me/${(settings.channel || 'hustlify').replace('@', '')}/${Math.floor(
        Math.random() * 800 + 100
      )}`,
    };
    onUpdatePost(updated);
    showToast('Пост опубликован в канале');
  };

  if (!posts.length) {
    return (
      <div className="card muted">
        Пока пусто. Выбери пункт во вкладке «План» или создай пост во вкладке «Новый пост».
      </div>
    );
  }

  return (
    <div>
      {posts.map((p) => {
        const plainText = p.html.replace(/<[^>]+>/g, '');
        return (
          <div className="card" key={p.id} data-id={p.id}>
            <BannerPreview spec={p.banner} />

            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className={`badge ${p.status}`}>{STATUS_MAP[p.status] || p.status}</span>
              <span className="muted small grow" style={{ textAlign: 'right' }}>
                #{p.id}
              </span>
            </div>

            <div className="excerpt">{plainText}</div>

            {p.channel_link && (
              <div style={{ marginBottom: 8 }}>
                <a
                  href={p.channel_link}
                  target="_blank"
                  rel="noreferrer"
                  className="small"
                  style={{ color: 'var(--ok)', textDecoration: 'none' }}
                >
                  🔗 Ссылка в канале: {p.channel_link}
                </a>
              </div>
            )}

            {p.error && (
              <div className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
                {p.error}
              </div>
            )}

            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="b s w" onClick={() => onOpenDraft(p)}>
                Открыть и править
              </button>

              <button className="b s" onClick={() => handleSendToChat(p)}>
                Прислать в чат
              </button>

              {p.status !== 'published' && (
                <button className="b s g" onClick={() => handlePublish(p)}>
                  Опубликовать
                </button>
              )}

              <button
                className="b s d"
                onClick={() => {
                  if (window.confirm('Удалить пост?')) {
                    onDeletePost(p.id);
                  }
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
